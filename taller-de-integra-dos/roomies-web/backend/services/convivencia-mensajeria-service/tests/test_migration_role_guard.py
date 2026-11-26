"""Compatibilidad del bootstrap con la membresía administrada por Supabase."""
from pathlib import Path

import psycopg
import pytest


@pytest.fixture
def role_guard(migrated_database):
    source = (Path(__file__).resolve().parents[1] / "migrations/001_convivencia_schema.up.sql").read_text(encoding="utf-8")
    guard = source[source.index("DO $$"):source.index("END $$;") + len("END $$;")]
    with psycopg.connect(migrated_database) as connection:
        # Roles y membresías de la prueba se revierten incluso cuando pasa.
        with connection.transaction(force_rollback=True):
            connection.execute("CREATE ROLE postgres NOLOGIN")
            connection.execute("CREATE ROLE e04_untrusted NOLOGIN")
            yield connection, guard


def test_acepta_rol_runtime_sin_membresias(role_guard):
    connection, guard = role_guard
    connection.execute(guard)


def test_acepta_administracion_inversa_supabase_sin_herencia_runtime(role_guard):
    connection, guard = role_guard
    connection.execute("SET LOCAL ROLE supabase_admin")
    connection.execute("GRANT sql_convivencia_mensajeria TO postgres WITH ADMIN TRUE, INHERIT FALSE, SET FALSE GRANTED BY supabase_admin")
    connection.execute("RESET ROLE")
    connection.execute(guard)
    assert connection.execute("SELECT pg_has_role('sql_convivencia_mensajeria','postgres','MEMBER')").fetchone() == (False,)


@pytest.mark.parametrize("statement", [
    "GRANT e04_untrusted TO sql_convivencia_mensajeria",
    "GRANT sql_convivencia_mensajeria TO e04_untrusted",
])
def test_rechaza_herencia_y_otros_miembros(role_guard, statement):
    connection, guard = role_guard
    connection.execute(statement)
    with pytest.raises(psycopg.errors.RaiseException, match="Falta un rol de runtime dedicado"):
        connection.execute(guard)


def test_rechaza_membresia_supabase_si_hereda(role_guard):
    connection, guard = role_guard
    connection.execute("SET LOCAL ROLE supabase_admin")
    connection.execute("GRANT sql_convivencia_mensajeria TO postgres WITH ADMIN TRUE, INHERIT TRUE GRANTED BY supabase_admin")
    connection.execute("RESET ROLE")
    with pytest.raises(psycopg.errors.RaiseException, match="Falta un rol de runtime dedicado"):
        connection.execute(guard)


def test_rechaza_membresia_supabase_si_permite_set_role(role_guard):
    connection, guard = role_guard
    connection.execute("GRANT sql_convivencia_mensajeria TO postgres WITH ADMIN TRUE, INHERIT FALSE, SET TRUE GRANTED BY supabase_admin")
    with pytest.raises(psycopg.errors.RaiseException, match="Falta un rol de runtime dedicado"):
        connection.execute(guard)
