"""Provisionar roomies_local en PostgreSQL Windows real, sin Docker ni identidad ficticia.

La credencial administrativa se lee de un JSON privado; nunca se imprime.
Los archivos SQL y sus hashes quedan registrados en la misma transacción.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import secrets

import psycopg
from psycopg import sql

ROOT = Path(__file__).resolve().parents[2]
HERE = Path(__file__).resolve().parent
PRIVATE = Path(os.environ["LOCALAPPDATA"]) / "Roomies/local-e03"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--credential-file", type=Path, default=PRIVATE / "postgres-admin.json")
    args = parser.parse_args()
    credentials = json.loads(args.credential_file.read_text(encoding="utf-8"))
    if credentials.get("host") != "127.0.0.1" or credentials.get("port") != 5432:
        raise SystemExit("Solo se admite PostgreSQL local 127.0.0.1:5432.")
    credentials["dbname"] = "postgres"
    roles = ("sql_auth_users", "sql_listado_applications", "sql_match_conexion", "sql_convivencia_mensajeria")
    runtime_file = args.credential_file.parent / "runtime-local.json"
    runtime = json.loads(runtime_file.read_text(encoding="utf-8")) if runtime_file.exists() else {}
    with psycopg.connect(**credentials, connect_timeout=5, autocommit=True) as connection:
        for role in roles:
            exists = connection.execute("SELECT 1 FROM pg_roles WHERE rolname=%s", (role,)).fetchone()
            if exists and role not in runtime:
                raise SystemExit("Existe un rol sin credencial privada registrada; no se cambia su contraseña.")
            if not exists:
                runtime.setdefault(role, secrets.token_urlsafe(36))
                runtime_file.write_text(json.dumps(runtime), encoding="utf-8")
                connection.execute(sql.SQL("CREATE ROLE {} LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD {}").format(sql.Identifier(role), sql.Literal(runtime[role])))
            flags = connection.execute("SELECT rolsuper,rolcreatedb,rolcreaterole,rolreplication,rolbypassrls,rolinherit FROM pg_roles WHERE rolname=%s", (role,)).fetchone()
            if any(flags):
                raise SystemExit("Rol existente con privilegios incompatibles; no se modificó.")
        if not connection.execute("SELECT 1 FROM pg_database WHERE datname='roomies_local'").fetchone():
            connection.execute("CREATE DATABASE roomies_local")
            print("CREATE DATABASE roomies_local")
    credentials["dbname"] = "roomies_local"
    bootstrap = (HERE / "bootstrap.sql").read_text(encoding="utf-8")
    bootstrap = bootstrap.replace("roomies_sprint2_disposable", "roomies_local")
    bootstrap = re.sub(r"^CREATE ROLE .*;\s*$", "", bootstrap, flags=re.M)
    bootstrap = bootstrap.replace("CREATE SCHEMA auth_users;", "")
    bootstrap = re.sub(r"CREATE TABLE auth_users.usuario \(.*?\n\);", "", bootstrap, count=1, flags=re.S)
    auth = ROOT / "backend/services/auth-users-service/migrations"
    files = [(str(p.relative_to(ROOT)), p.read_text(encoding="utf-8")) for p in sorted(auth.glob("*.up.sql"))]
    files.append(("backend/local_stack/bootstrap.sql@local-v1", bootstrap))
    supplement = HERE / "local_runtime.up.sql"
    files.append((str(supplement.relative_to(ROOT)), supplement.read_text(encoding="utf-8")))
    for service in ("listado-applications-service", "convivencia-mensajeria-service"):
        migrations = ROOT / "backend/services" / service / "migrations"
        for p in sorted(migrations.glob("*.sql")):
            if ".down." not in p.name:
                files.append((str(p.relative_to(ROOT)), p.read_text(encoding="utf-8")))
    with psycopg.connect(**credentials, connect_timeout=5) as connection:
        connection.execute("SELECT pg_advisory_xact_lock(hashtextextended('roomies_local:migrations',0))")
        if not connection.execute("SELECT to_regclass('roomies_local_meta.migration')").fetchone()[0]:
            existing = connection.execute("SELECT nspname FROM pg_namespace WHERE nspname IN ('auth_users','listado_applications','convivencia_mensajeria')").fetchall()
            if existing:
                raise SystemExit("Hay esquemas existentes sin registro de migraciones; se requiere conciliación, no se sobreescriben.")
        connection.execute("CREATE SCHEMA IF NOT EXISTS roomies_local_meta")
        connection.execute("REVOKE ALL ON SCHEMA roomies_local_meta FROM PUBLIC")
        connection.execute("CREATE TABLE IF NOT EXISTS roomies_local_meta.migration(path text PRIMARY KEY, sha256 text NOT NULL, applied_at timestamptz NOT NULL DEFAULT clock_timestamp())")
        for path, source in files:
            digest = hashlib.sha256(source.encode()).hexdigest()
            previous = connection.execute("SELECT sha256 FROM roomies_local_meta.migration WHERE path=%s", (path,)).fetchone()
            if previous:
                if previous[0] != digest:
                    raise SystemExit("Una migración aplicada cambió: " + path)
                print("SKIP", path)
                continue
            # Todos los archivos se confirman juntos; no hay commits parciales.
            body = re.sub(r"^\s*(?:BEGIN|COMMIT);\s*$", "", source, flags=re.M)
            connection.execute(body, prepare=False)
            connection.execute("INSERT INTO roomies_local_meta.migration(path,sha256) VALUES(%s,%s)", (path, digest))
            print("APPLY", path)
        constraints = connection.execute("SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conrelid='convivencia_mensajeria.mensajes'::regclass AND contype='u'").fetchall()
        print("UNIQUE mensajes:", constraints)
    print("PASS migraciones confirmadas sobre 127.0.0.1:5432/roomies_local; sin mocks.")


if __name__ == "__main__":
    main()
