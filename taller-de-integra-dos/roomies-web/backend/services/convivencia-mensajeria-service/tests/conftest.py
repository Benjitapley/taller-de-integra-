import os
from pathlib import Path
import threading
from uuid import uuid5, NAMESPACE_URL

import psycopg
from psycopg import sql
import pytest


@pytest.fixture(scope="session")
def migrated_database():
    dsn = os.environ.get("CONVIVENCIA_TEST_ADMIN_DSN")
    if not dsn:
        pytest.skip("Ejecutar tests/run_isolated.py: nunca se usa una DB existente.")
    migrations = Path(__file__).resolve().parents[1] / "migrations"
    with psycopg.connect(dsn) as connection:
        for migration in sorted(migrations.glob("*.up.sql")):
            connection.execute(migration.read_text(encoding="utf-8"))
        connection.execute("CREATE SCHEMA forbidden_test")
        connection.execute("REVOKE ALL ON SCHEMA forbidden_test FROM PUBLIC")
        connection.execute("CREATE TABLE forbidden_test.secret(id int)")
    return dsn


@pytest.fixture
def empty_database(migrated_database):
    with psycopg.connect(migrated_database) as connection:
        names = connection.execute("SELECT tablename FROM pg_tables WHERE schemaname='convivencia_mensajeria'").fetchall()
        if names:
            connection.execute(sql.SQL("TRUNCATE {} RESTART IDENTITY CASCADE").format(sql.SQL(",").join(
                sql.Identifier("convivencia_mensajeria", row[0]) for row in names)))


class Identity:
    def __init__(self):
        self.allowed = True

    def enabled(self, user_id):
        return self.allowed


class Publications:
    """Thread-safe firm reservation fake; local invariants still run in real SQL."""
    def __init__(self):
        self.capacity = 2
        self.reservations = {}
        self.confirmed = set()
        self.released = set()
        self.calls = []
        self.lock = threading.Lock()
        self.lost_response = False
        self.confirm_down = False
        self.release_down = False
        self.confirmations = []
        self.owner_id = 1
        self.expulsion_down = False
        self.expulsion_updates = []

    def owner(self, publication_id):
        return self.owner_id

    def expulsion_occupancy(self, publication_id, projection):
        if self.expulsion_down:
            raise TimeoutError("synthetic unavailable occupancy")
        self.expulsion_updates.append((publication_id, projection))

    def reserve(self, key, payload):
        with self.lock:
            self.calls.append(str(key))
            reservation = self.reservations.setdefault(str(key), {
                **payload, "id_reserva": str(uuid5(NAMESPACE_URL, str(key))),
                "cupos_totales": self.capacity,
            })
            if self.lost_response:
                self.lost_response = False
                from app.models import unavailable
                raise unavailable()
            return reservation.copy()

    def confirm(self, key, reservation):
        if self.confirm_down:
            raise TimeoutError("synthetic timeout")
        self.confirmed.add((str(reservation["id_reserva"]), str(key)))
        self.confirmations.append(reservation["confirmacion"].copy())

    def release(self, key, reservation):
        if self.release_down:
            raise TimeoutError("synthetic release timeout")
        self.released.add((str(reservation["id_reserva"]), str(key)))


@pytest.fixture
def ports():
    return Identity(), Publications()


@pytest.fixture
def repository():
    from app.repository import PostgresRepository
    return PostgresRepository()


@pytest.fixture
def service(repository, ports):
    from app.service import Convivencia
    return Convivencia(repository, *ports)
