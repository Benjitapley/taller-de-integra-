"""Etapa aditiva ensayada en réplica ficticia, con restauración real del dump local."""
import hashlib
from pathlib import Path
import psycopg
from psycopg import sql
from psycopg.conninfo import conninfo_to_dict
from backup_restore import fingerprints, run_tool

PROPOSAL = Path(__file__).resolve().parents[2] / "migration-proposals/sprint2-supabase/stage1-additive.sql"


def restored_fixture(owner, pgbin, fixture, clean):
    parts = conninfo_to_dict(owner)
    password = parts.pop("password")
    source = " ".join(f"{key}={value}" for key, value in parts.items())
    archive = fixture / "fixture.dump"
    env = {**clean, "PGPASSWORD": password}
    with psycopg.connect(owner) as connection:
        expected = fingerprints(connection)
    run_tool(pgbin / "pg_dump.exe", ["--dbname=" + source, "--schema=haycupo", "--format=custom", "--no-owner", "--no-acl", "--file=" + str(archive)], env)
    with psycopg.connect(owner, autocommit=True) as connection:
        connection.execute("CREATE DATABASE roomies_restore_check")
    restored = owner.replace("dbname=roomies_sprint2_disposable", "dbname=roomies_restore_check")
    with psycopg.connect(restored) as connection:
        connection.execute("CREATE TYPE public.estadoconexion AS ENUM('Pendiente','Aceptada','Rechazada')")
    target = source.replace("dbname=roomies_sprint2_disposable", "dbname=roomies_restore_check")
    run_tool(pgbin / "pg_restore.exe", ["--dbname=" + target, "--no-owner", "--no-acl", "--exit-on-error", str(archive)], env)
    with psycopg.connect(restored) as connection:
        assert fingerprints(connection) == expected
    print("PASS respaldo/restauración de réplica ficticia: cuatro tablas, IDs y huellas idénticas", flush=True)
    return hashlib.sha256(archive.read_bytes()).hexdigest()


def prepare(connection, digest):
    original = connection.execute("SELECT c.oid,c.relname,a.attname,a.atttypid,a.atttypmod FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid WHERE n.nspname='haycupo' AND c.relkind='r' AND a.attnum>0 ORDER BY c.oid,a.attnum").fetchall()
    rows = fingerprints(connection)
    connection.execute("CREATE ROLE ti4_mobile NOLOGIN")
    connection.execute("GRANT USAGE ON SCHEMA haycupo TO ti4_mobile")
    connection.execute("GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA haycupo TO ti4_mobile")
    connection.execute("SAVEPOINT unapproved")
    try:
        connection.execute(PROPOSAL.read_text(encoding="utf-8"), prepare=False)
        raise AssertionError("Etapa sin aprobación")
    except psycopg.errors.RaiseException:
        connection.execute("ROLLBACK TO SAVEPOINT unapproved")
    connection.execute("SELECT set_config('roomies.stage1_approved','reviewed',true),set_config('roomies.backup_verified',%s,true)", (digest,))
    connection.execute(PROPOSAL.read_text(encoding="utf-8"), prepare=False)
    assert rows == fingerprints(connection)
    assert original == connection.execute("SELECT c.oid,c.relname,a.attname,a.atttypid,a.atttypmod FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace JOIN pg_attribute a ON a.attrelid=c.oid WHERE n.nspname='haycupo' AND c.relkind='r' AND a.attnum>0 ORDER BY c.oid,a.attnum").fetchall()
    assert connection.execute("SELECT count(*) FROM auth_users.identidad").fetchone()[0] == 0
    assert connection.execute("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='haycupo' AND c.relkind='r' AND c.relrowsecurity").fetchone()[0] == 0
    assert connection.execute("SELECT has_table_privilege('ti4_mobile','haycupo.usuario','SELECT,INSERT,UPDATE,DELETE')").fetchone()[0]
    assert not connection.execute("SELECT has_column_privilege('sql_auth_users','haycupo.usuario','contrasena','SELECT')").fetchone()[0]
    print("PASS etapa aditiva: sin traslado/cambios de columnas/tipos/datos/RLS heredada; conserva permisos TI4 y deniega hashes a Auth", flush=True)
