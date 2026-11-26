"""Suite SQL en servidor local existente, sin initdb ni cambios a bases existentes.

CONVIVENCIA_TEST_SERVER_DSN: conexión administrativa a /postgres en 127.0.0.1:5432.
La suite sigue usando dobles HTTP; este comando no acredita un recorrido E2E.
"""
import os
from pathlib import Path
import secrets
import sys
from urllib.parse import urlsplit, unquote

import psycopg
from psycopg import sql
from psycopg.conninfo import make_conninfo


def main():
    server = os.environ.get("CONVIVENCIA_TEST_SERVER_DSN", "")
    try:
        target = urlsplit(server)
        valid = (target.scheme == "postgresql" and target.hostname == "127.0.0.1"
                 and target.port == 5432 and target.path == "/postgres"
                 and not target.query and not target.fragment)
    except ValueError:
        valid = False
    if not valid:
        raise SystemExit("Define CONVIVENCIA_TEST_SERVER_DSN como URI administrativa a 127.0.0.1:5432/postgres.")
    database = "roomies_sprint2_disposable"
    role = "sql_convivencia_mensajeria"
    password = secrets.token_hex(32)
    created_role = created_database = False
    try:
        with psycopg.connect(server, autocommit=True, connect_timeout=5) as admin:
            if admin.execute("SELECT 1 FROM pg_database WHERE datname=%s", (database,)).fetchone():
                raise SystemExit("Base de pruebas ya existente: no se modifica ni elimina. Usa una instancia donde ese nombre esté libre.")
            existing_role = admin.execute("SELECT 1 FROM pg_roles WHERE rolname=%s", (role,)).fetchone()
            runtime = os.environ.get("CONVIVENCIA_DATABASE_URL", "")
            if existing_role:
                parsed = urlsplit(runtime)
                if (parsed.hostname != "127.0.0.1" or parsed.port != 5432
                        or unquote(parsed.username or "") != role or parsed.path != "/" + database
                        or parsed.query or parsed.fragment):
                    raise SystemExit("Rol existente: configura CONVIVENCIA_DATABASE_URL con su credencial vigente. No se altera su contraseña.")
            else:
                admin.execute(sql.SQL("CREATE ROLE {} LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD {}").format(sql.Identifier(role), sql.Literal(password)))
                created_role = True
                runtime = f"postgresql://{role}:{password}@127.0.0.1:5432/{database}"
            admin.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(database)))
            created_database = True
            service = Path(__file__).resolve().parents[1]
            sys.path[:0] = [str(service), str(service.parents[2])]
            os.environ.update({
                "CONVIVENCIA_TEST_ADMIN_DSN": make_conninfo(server, dbname=database),
                "CONVIVENCIA_DATABASE_URL": runtime,
                "ROOMIES_LOCAL_MODE": "1", "ROOMIES_RUNTIME_MODE": "disposable",
                "ROOMIES_INTERNAL_TOKEN": secrets.token_hex(32),
                "PYTEST_DISABLE_PLUGIN_AUTOLOAD": "1",
            })
            import pytest
            print("PostgreSQL real 127.0.0.1:5432; base nueva exclusiva; puertos HTTP simulados por la suite.")
            return pytest.main([str(service / "tests"), "--rootdir", str(service),
                                "--confcutdir", str(service), "--import-mode=importlib",
                                "-q", "-p", "no:cacheprovider", *sys.argv[1:]])
    except psycopg.Error as error:
        raise SystemExit(f"PostgreSQL local: {type(error).__name__}. Revisa acceso administrativo y credenciales (DSN omitido).") from None
    finally:
        if created_database or created_role:
            with psycopg.connect(server, autocommit=True, connect_timeout=5) as admin:
                if created_database:
                    admin.execute(sql.SQL("DROP DATABASE {} WITH (FORCE)").format(sql.Identifier(database)))
                if created_role:
                    admin.execute(sql.SQL("DROP ROLE {}").format(sql.Identifier(role)))


if __name__ == "__main__":
    raise SystemExit(main())
