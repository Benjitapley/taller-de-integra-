"""Opt-in integration tests; they touch only an explicitly named local DB."""

import os
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from datetime import date
from threading import Barrier
from urllib.parse import unquote, urlsplit
from uuid import UUID, uuid4

import pytest

from app.domain.profile import ProfilePatch
from app.infrastructure.persistence.postgres_profile_repository import (
    PostgresProfileRepository,
)
from app.infrastructure.persistence.settings import PostgresDatabaseSettings


TEST_DATABASE_NAME = "roomies_auth_users_test"
TEST_HOST = "127.0.0.1"
TEST_PORT = 15432
OTHER_SCHEMA = "auth_users_test_other_domain"
MIGRATIONS = Path(__file__).resolve().parents[1] / "migrations"


def test_integration_url_parser_accepts_runtime_and_migrator_on_same_exact_endpoint():
    admin_target = _parse_local_test_url(
        "postgresql://roomies_auth_users_migrator@127.0.0.1:15432/roomies_auth_users_test"
    )
    runtime_target = _parse_local_test_url(
        "postgresql://sql_auth_users@127.0.0.1:15432/roomies_auth_users_test",
        required_user="sql_auth_users",
    )

    assert admin_target == runtime_target


@pytest.mark.parametrize(
    "url",
    [
        "postgresql://migrator@localhost:15432/roomies_auth_users_test",
        "postgresql://migrator@127.0.0.1:5432/roomies_auth_users_test",
        "postgresql://migrator@127.0.0.1:15432/roomies_auth_users_dev",
        "postgresql://migrator@db.example:15432/roomies_auth_users_test",
        "postgresql://migrator@127.0.0.1:15432/roomies_auth_users_test?host=other",
    ],
)
def test_integration_url_parser_rejects_wrong_host_port_database_or_overrides(url):
    with pytest.raises(ValueError):
        _parse_local_test_url(url)


def _parse_local_test_url(value: str, *, required_user: str | None = None) -> tuple[str, str, int, str]:
    if not value:
        raise ValueError("Falta una URL explícita de PostgreSQL de pruebas.")
    try:
        parsed = urlsplit(value)
        database_name = unquote(parsed.path.removeprefix("/"))
        port = parsed.port
    except (ValueError, UnicodeError):
        raise ValueError("La URL PostgreSQL de pruebas no es válida.") from None
    if (
        parsed.scheme not in {"postgres", "postgresql"}
        or parsed.hostname != TEST_HOST
        or port != TEST_PORT
        or database_name != TEST_DATABASE_NAME
        or not parsed.username
        or (required_user is not None and parsed.username != required_user)
        or (required_user is None and parsed.username == "sql_auth_users")
        or parsed.query
        or parsed.fragment
    ):
        raise ValueError(
            "La URL debe apuntar a 127.0.0.1:15432/roomies_auth_users_test."
        )
    return parsed.scheme, parsed.hostname, port, database_name


def _safe_local_url(
    variable_name: str, *, required_user: str | None = None
) -> tuple[str, tuple[str, str, int, str]]:
    value = os.environ.get(variable_name, "")
    if not value:
        pytest.skip("Falta configuración explícita de PostgreSQL desechable.")
    try:
        target = _parse_local_test_url(value, required_user=required_user)
    except ValueError as error:
        pytest.fail(str(error))
    return value, target


@pytest.fixture(scope="module")
def disposable_postgres():
    if os.environ.get("AUTH_USERS_RUN_POSTGRES_INTEGRATION") != "1":
        pytest.skip("PostgreSQL de integración requiere habilitación explícita.")
    psycopg = pytest.importorskip("psycopg")
    admin_url, admin_target = _safe_local_url("AUTH_USERS_TEST_ADMIN_DATABASE_URL")
    runtime_url, runtime_target = _safe_local_url(
        "AUTH_USERS_TEST_DATABASE_URL", required_user="sql_auth_users"
    )
    if admin_target != runtime_target:
        pytest.fail("Las conexiones de migración y runtime deben apuntar al mismo servidor, puerto y base.")

    migrations_up = [
        (MIGRATIONS / "001_auth_users_schema.up.sql").read_text(encoding="utf-8"),
        (MIGRATIONS / "002_auth_users_runtime_grants.up.sql").read_text(encoding="utf-8"),
    ]
    migrations_down = [
        (MIGRATIONS / "002_auth_users_runtime_grants.down.sql").read_text(encoding="utf-8"),
        (MIGRATIONS / "001_auth_users_schema.down.sql").read_text(encoding="utf-8"),
    ]
    setup_committed = False

    try:
        with psycopg.connect(admin_url) as admin:
            with admin.cursor() as cursor:
                cursor.execute("SELECT current_database()")
                if cursor.fetchone()[0] != TEST_DATABASE_NAME:
                    pytest.fail("La conexión migradora no está en la base local de pruebas esperada.")
                cursor.execute("SELECT to_regnamespace('auth_users')")
                if cursor.fetchone()[0] is not None:
                    pytest.fail("La base desechable ya contiene auth_users; no se alteró.")
                cursor.execute(f"SELECT to_regnamespace('{OTHER_SCHEMA}')")
                if cursor.fetchone()[0] is not None:
                    pytest.fail("La base desechable ya contiene el esquema auxiliar; no se alteró.")
                cursor.execute("SELECT to_regrole('sql_auth_users')")
                if cursor.fetchone()[0] is None:
                    pytest.skip("Provisiona el rol local sql_auth_users para integración.")
                cursor.execute(
                    "SELECT r.rolsuper, d.datdba = r.oid "
                    "FROM pg_roles r JOIN pg_database d ON d.datname = current_database() "
                    "WHERE r.rolname = current_user"
                )
                is_superuser, owns_database = cursor.fetchone()
                if not (is_superuser or owns_database):
                    pytest.skip("La conexión de migración debe ser superusuario o propietaria de la base desechable.")
                cursor.execute(
                    "SELECT has_schema_privilege('sql_auth_users', 'public', 'USAGE'), "
                    "has_schema_privilege('sql_auth_users', 'public', 'CREATE')"
                )
                if cursor.fetchone() != (False, False):
                    pytest.fail("Revoca PUBLIC en public de la base de pruebas antes de migrar.")
                cursor.execute(migrations_up[0], prepare=False)
                cursor.execute(migrations_up[1], prepare=False)
                cursor.execute(f"CREATE SCHEMA {OTHER_SCHEMA}")
                cursor.execute(f"CREATE TABLE {OTHER_SCHEMA}.sentinel (id integer PRIMARY KEY)")
        setup_committed = True

        settings = PostgresDatabaseSettings(
            database_url=runtime_url,
            connect_timeout_seconds=3,
        )
        yield PostgresProfileRepository(
            settings,
            connector=lambda: psycopg.connect(runtime_url, connect_timeout=3),
        ), runtime_url
    finally:
        if setup_committed:
            with psycopg.connect(admin_url) as admin:
                with admin.cursor() as cursor:
                    cursor.execute(f"DROP SCHEMA {OTHER_SCHEMA} CASCADE")
                    cursor.execute(migrations_down[0], prepare=False)
                    cursor.execute(migrations_down[1], prepare=False)


def test_postgres_persists_profiles_idempotently_and_isolates_users(disposable_postgres):
    repo, runtime_url = disposable_postgres
    identity_a, identity_b = uuid4(), uuid4()

    first = repo.ensure_profile(identity_a, nombre="Ana", fecha_nacimiento=date(2000, 3, 5))
    retry = repo.ensure_profile(identity_a, nombre="Otro nombre", fecha_nacimiento=date(2001, 4, 6))
    second = repo.ensure_profile(identity_b, nombre="Benja", fecha_nacimiento=date(1999, 7, 8))

    assert first.id_usuario == retry.id_usuario
    assert retry.nombre == "Ana"  # A retry cannot overwrite existing profile data.
    assert second.id_usuario != first.id_usuario
    assert repo.get_by_supabase_user_id(identity_a).supabase_user_id == identity_a
    assert repo.get_by_supabase_user_id(identity_b).supabase_user_id == identity_b
    assert repo.get_by_supabase_user_id(uuid4()) is None

    changed = repo.patch_by_supabase_user_id(
        identity_a,
        ProfilePatch(fields_set=frozenset({"ciudad"}), ciudad="Temuco"),
    )
    assert changed.ciudad == "Temuco"
    assert repo.get_by_supabase_user_id(identity_b).ciudad is None

    concurrent_identity = uuid4()
    start_together = Barrier(2)

    def initialize(name):
        start_together.wait(timeout=5)
        return repo.ensure_profile(
            concurrent_identity, nombre=name, fecha_nacimiento=date(2000, 3, 5)
        )

    with ThreadPoolExecutor(max_workers=2) as pool:
        concurrent_results = list(pool.map(initialize, ("Cami", "Diego")))
    assert concurrent_results[0].id_usuario == concurrent_results[1].id_usuario
    assert repo.get_by_supabase_user_id(concurrent_identity).nombre in {"Cami", "Diego"}

    psycopg = pytest.importorskip("psycopg")
    with psycopg.connect(runtime_url) as runtime:
        with runtime.cursor() as cursor:
            cursor.execute("SELECT current_user, rolsuper FROM pg_roles WHERE rolname = current_user")
            assert cursor.fetchone() == ("sql_auth_users", False)
            cursor.execute(
                "SELECT has_schema_privilege(current_user, 'public', 'USAGE'), "
                "has_table_privilege(current_user, 'auth_users.usuario', 'DELETE'), "
                "has_column_privilege(current_user, 'auth_users.usuario', 'nombre', 'UPDATE'), "
                "has_column_privilege(current_user, 'auth_users.usuario', 'ciudad', 'UPDATE')"
            )
            assert cursor.fetchone() == (False, False, False, True)
            with pytest.raises(psycopg.errors.InsufficientPrivilege):
                cursor.execute(f"SELECT * FROM {OTHER_SCHEMA}.sentinel")

    # The database uniqueness constraint must reject a second physical row for one UUID.
    with psycopg.connect(runtime_url) as runtime:
        with runtime.cursor() as cursor:
            with pytest.raises(psycopg.errors.UniqueViolation):
                cursor.execute(
                    "INSERT INTO auth_users.usuario (supabase_user_id, nombre, fecha_nacimiento) "
                    "VALUES (%s, %s, %s)",
                    (identity_a, "Duplicado", date(2000, 3, 5)),
                )
