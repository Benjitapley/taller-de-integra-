"""Crear y verificar exclusivamente un clúster PostgreSQL desechable propio."""
import argparse
import json
import os
from pathlib import Path
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile
import time

ROOT=Path(__file__).resolve().parents[2]
HERE=Path(__file__).resolve().parent
sys.path.insert(0,str(HERE))
sys.stdout.reconfigure(encoding="utf-8",errors="replace")
parser=argparse.ArgumentParser()
parser.add_argument("--pg-bin",required=True)
parser.add_argument("--schema-only",action="store_true")
parser.add_argument("--web", action="store_true", help="Probar también BFF Next.js y navegador local")
parser.add_argument("--compatibility", action="store_true", help="Validar propuesta contra réplica estructural ficticia de haycupo")
parser.add_argument("--verify-backup", metavar="SOURCE_ENV", help="Respaldo remoto de solo lectura y restauración local; no aplica migraciones")
parser.add_argument("--backup-ca", help="Certificado CA oficial para verificar TLS del respaldo")
parser.add_argument("--restore-backup", metavar="DPAPI_ARCHIVE", help="Descifrar y restaurar respaldo guardado, solo en clúster local desechable")
parser.add_argument("--progressive", action="store_true", help="Ensayar etapa aditiva con tablas en haycupo")
args=parser.parse_args()
if sum(bool(value) for value in (args.compatibility,args.progressive,args.verify_backup,args.restore_backup))>1:
    parser.error("Selecciona un único ensayo o modo de respaldo")
pgbin=Path(args.pg_bin)
if not (pgbin/"initdb.exe").is_file(): raise RuntimeError("Falta PostgreSQL local")
clean={k:v for k,v in os.environ.items() if k.upper() in {"SYSTEMROOT","WINDIR","TEMP","TMP","COMSPEC","PATH","PATHEXT"}}
os.environ.clear();os.environ.update(clean)
sys.dont_write_bytecode=True
import psycopg
from psycopg import sql


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1",0));return sock.getsockname()[1]


def command(program,*parameters):
    # PostgreSQL hereda handles: un PIPE puede quedar abierto por sus hijos.
    with tempfile.TemporaryFile() as log:
        result=subprocess.run([str(program),*map(str,parameters)],env=clean,stdout=log,stderr=log,
                              timeout=60,creationflags=subprocess.CREATE_NO_WINDOW)
        log.seek(0)
        output=log.read().decode(errors="replace")
    if result.returncode: raise RuntimeError(output)


def verify_schema(owner,urls,progressive=False):
    schemas={"auth":"auth_users","listado":"listado_applications","match":"match_conexion"}
    with psycopg.connect(owner) as connection:
        assert connection.execute("SELECT count(*) FROM pg_constraint c JOIN pg_namespace n ON n.oid=c.connamespace WHERE n.nspname IN ('auth_users','listado_applications','match_conexion') AND c.contype='f'").fetchone()[0]==(5 if progressive else 4)
        assert connection.execute("SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname IN ('auth_users','listado_applications','match_conexion') AND c.relkind='r' AND NOT c.relrowsecurity").fetchone()[0]==0
    tables={"auth":"usuario","listado":"publicacion","match":"conexion"}
    if progressive: schemas={key:"haycupo" for key in schemas}
    for service,url in urls.items():
        with psycopg.connect(url) as connection:
            flags=connection.execute("SELECT rolsuper,rolbypassrls,rolcreatedb,rolcreaterole,rolinherit FROM pg_roles WHERE rolname=current_user").fetchone()
            assert flags==(False,False,False,False,False)
            column="id_usuario" if progressive and service=="auth" else "*"
            connection.execute(f"SELECT {column} FROM {schemas[service]}.{tables[service]} LIMIT 0")
        for other in schemas:
            if other==service: continue
            try:
                with psycopg.connect(url) as connection:
                    connection.execute(f"SELECT * FROM {schemas[other]}.{tables[other]} LIMIT 0")
                raise AssertionError("Acceso cruzado permitido")
            except psycopg.errors.InsufficientPrivilege: pass
        try:
            with psycopg.connect(url) as connection: connection.execute("CREATE SCHEMA forbidden_schema")
            raise AssertionError("DDL permitido al runtime")
        except psycopg.errors.InsufficientPrivilege: pass
    # SQLAlchemy real, sin crear ni cambiar tablas y usando los mismos roles.
    from sqlalchemy import create_engine,inspect,text
    for service,url in urls.items():
        engine=create_engine(url.replace("postgresql://","postgresql+psycopg://",1))
        try:
            assert tables[service] in inspect(engine).get_table_names(schema=schemas[service])
            with engine.connect() as connection:
                column="id_usuario" if progressive and service=="auth" else "*"
                connection.execute(text(f"SELECT {column} FROM {schemas[service]}.{tables[service]} LIMIT 0"))
        finally: engine.dispose()
    print("PASS bootstrap, FK internas, RLS, roles mínimos, 6 denegaciones cruzadas, DDL denegado y SQLAlchemy",flush=True)


def run():
    with tempfile.TemporaryDirectory(prefix="roomies-sprint2-disposable-") as temporary:
        fixture=Path(temporary).resolve();pgdata=fixture/"postgres"
        port=free_port();started=False
        root_password=secrets.token_hex(32)
        password_file=fixture/"owner-password"
        password_file.write_text(root_password,encoding="utf-8")
        owner=f"host=127.0.0.1 port={port} user=roomies_test_owner password={root_password} dbname=postgres connect_timeout=3"
        roles={"auth":"sql_auth_users","listado":"sql_listado_applications","match":"sql_match_conexion"}
        passwords={service:secrets.token_hex(32) for service in roles}
        processes=[]
        try:
            command(pgbin/"initdb.exe","-D",pgdata,"-U","roomies_test_owner","--pwfile",password_file,"--auth-local=trust","--auth-host=scram-sha-256","--encoding=UTF8","--no-locale")
            command(pgbin/"pg_ctl.exe","-D",pgdata,"-l",fixture/"postgres.log","-o",f"-h 127.0.0.1 -p {port}","-w","start");started=True
            with psycopg.connect(owner,autocommit=True) as connection:
                connection.execute("CREATE DATABASE roomies_sprint2_disposable")
            owner=owner.replace("dbname=postgres","dbname=roomies_sprint2_disposable")
            if args.restore_backup:
                from backup_restore import restore_saved
                restore_saved(owner, pgbin, fixture, clean, args.restore_backup)
                return
            if args.verify_backup:
                from backup_restore import backup_and_restore
                backup_and_restore(owner, pgbin, fixture, clean, Path(args.verify_backup).resolve(), args.backup_ca)
                return
            digest = None
            if args.progressive:
                from compatibility import create_fixture
                from progressive import restored_fixture
                with psycopg.connect(owner) as connection: create_fixture(connection)
                digest = restored_fixture(owner, pgbin, fixture, clean)
            with psycopg.connect(owner) as connection:
                if args.progressive:
                    from progressive import prepare
                    prepare(connection, digest)
                elif args.compatibility:
                    from compatibility import prepare
                    prepare(connection)
                else:
                    connection.execute((HERE/"bootstrap.sql").read_text(encoding="utf-8"),prepare=False)
                for service,role in roles.items():
                    connection.execute(sql.SQL("ALTER ROLE {} LOGIN PASSWORD {}").format(sql.Identifier(role),sql.Literal(passwords[service])))
            urls={service:f"postgresql://{role}:{passwords[service]}@127.0.0.1:{port}/roomies_sprint2_disposable" for service,role in roles.items()}
            verify_schema(owner,urls,args.progressive)
            if not args.schema_only:
                from integration import run_integration
                run_integration(fixture,urls,clean,processes,web=args.web,baseline={"usuarios":1,"publicaciones":1,"conexiones":1} if args.compatibility or args.progressive else None,progressive=args.progressive)
            if args.compatibility:
                from compatibility import verify_rollback
                # Simular la ventana sin escritores exigida por la reversión.
                for process in reversed(processes):
                    if process.poll() is None:
                        subprocess.run(["taskkill","/PID",str(process.pid),"/T","/F"],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=subprocess.CREATE_NO_WINDOW)
                        process.wait(timeout=15)
                verify_rollback(owner)
        finally:
            for process in reversed(processes):
                if process.poll() is None:
                    subprocess.run(["taskkill","/PID",str(process.pid),"/T","/F"],stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,creationflags=subprocess.CREATE_NO_WINDOW)
                    process.wait(timeout=15)
            if started:
                command(pgbin/"pg_ctl.exe","-D",pgdata,"-m","immediate","-w","stop")
            assert pgdata.parent==fixture and fixture.name.startswith("roomies-sprint2-disposable-")
            print("PASS limpieza de procesos propios y clúster desechable",flush=True)


if __name__=="__main__": run()
