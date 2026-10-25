"""Own PostgreSQL cluster only. No inherited environment, dotenv or SMTP.
Usage: python -I -B .../run_disposable.py --pg-bin 'C:/Program Files/PostgreSQL/18/bin'
Never connects to the already installed service. Cluster stops in finally.
"""
import argparse
from contextlib import nullcontext
import os
import secrets
import socket
import subprocess
import sys
import tempfile
from pathlib import Path

root = Path(__file__).resolve().parents[3]
proposal = Path(__file__).resolve().parents[1]
parser = argparse.ArgumentParser()
parser.add_argument('--pg-bin', required=True)
args = parser.parse_args()
pg = Path(args.pg_bin).resolve()
keep = {k: v for k, v in os.environ.items() if k.upper() in {'SYSTEMROOT', 'WINDIR', 'TEMP', 'TMP', 'COMSPEC'}}
os.environ.clear()
os.environ.update(keep)
os.environ.update(AUTH_JWT_ENABLED='true', JWT_SECRET_KEY=secrets.token_hex(32), AUTH_CODE_SECRET=secrets.token_hex(32))
sys.path.insert(0, str(root))
import dotenv
dotenv.load_dotenv = lambda *a, **k: False
dotenv.dotenv_values = lambda *a, **k: (_ for _ in ()).throw(RuntimeError('dotenv forbidden'))
import smtplib
def forbidden(*a, **k):
    raise RuntimeError('External network/SMTP forbidden')
smtplib.SMTP = forbidden
smtplib.SMTP_SSL = forbidden
import psycopg
from psycopg import sql

def run(executable, *arguments):
    # Windows postgres children can inherit pipe handles after pg_ctl exits.
    # Use a file, not communicate() pipes that would wait for the server to stop.
    with tempfile.TemporaryFile() as output:
        completed = subprocess.run([str(pg / (executable + '.exe')), *map(str, arguments)], stdout=output, stderr=output, timeout=60)
        output.seek(0)
        log = output.read().decode('utf-8', errors='replace')
    if completed.returncode:
        raise RuntimeError(log)

with socket.socket() as probe:
    probe.bind(('127.0.0.1', 0))
    port = probe.getsockname()[1]

with tempfile.TemporaryDirectory(prefix='haycupo-pg-') as temporary:
    base = Path(temporary)
    data = base / 'data'
    run('initdb', '-D', data, '-U', 'fixture_owner', '--auth-local=trust', '--auth-host=trust', '--encoding=UTF8', '--no-locale')
    started = False
    try:
        # Trust is restricted to this ephemeral loopback cluster with synthetic data.
        run('pg_ctl', '-D', data, '-l', base / 'server.log', '-o', f'-h 127.0.0.1 -p {port}', '-w', 'start')
        started = True
        dsn = f'host=127.0.0.1 port={port} user=fixture_owner dbname=postgres connect_timeout=3'
        real_connect = psycopg.connect
        def connect_only_fixture(conninfo='', **kwargs):
            if conninfo != dsn or kwargs:
                raise RuntimeError('Only the generated disposable DSN is allowed')
            return real_connect(dsn)
        psycopg.connect = connect_only_fixture
        raw_connect = socket.socket.connect
        def local_connect(sock, address):
            if address[0] not in {'127.0.0.1', '::1'}:
                return forbidden()
            return raw_connect(sock, address)
        socket.socket.connect = local_connect
        socket.socket.connect_ex = forbidden
        socket.socket.sendto = forbidden
        checks = 0
        def check(condition):
            global checks
            assert condition
            checks += 1
        def rejected(conn, query, params=None, state=None):
            try:
                with conn.transaction():
                    conn.execute(query, params)
            except psycopg.Error as error:
                check(state is None or error.sqlstate == state)
            else:
                raise AssertionError('Expected PostgreSQL rejection')
        with psycopg.connect(dsn) as conn:
            conn.autocommit = True
            conn.execute('CREATE ROLE fixture_backend NOLOGIN NOSUPERUSER NOBYPASSRLS')
            conn.execute('CREATE ROLE fixture_client NOLOGIN NOSUPERUSER NOBYPASSRLS')
            conn.execute('CREATE SCHEMA haycupo')
            conn.execute('''CREATE TABLE haycupo.usuario (
                id_usuario bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                nombre text, correo text, contrasena text, fecha_nacimiento date,
                presupuesto numeric, zona_interes text, ocupacion text, edad integer,
                ciudad text, biografia text, foto_perfil text, breve_descripcion text, sobre_mi text)''')
            conn.execute('CREATE TABLE haycupo.publicacion (id_publicacion bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, id_usuario bigint REFERENCES haycupo.usuario(id_usuario))')
            conn.execute('CREATE TABLE haycupo.imagen_publicacion (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, id_publicacion bigint REFERENCES haycupo.publicacion(id_publicacion))')
            conn.execute('CREATE TABLE haycupo.conexion (id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY, origen bigint REFERENCES haycupo.usuario(id_usuario), destino bigint REFERENCES haycupo.usuario(id_usuario))')
            conn.execute('GRANT USAGE ON SCHEMA haycupo TO fixture_backend, fixture_client')
            conn.execute('GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA haycupo TO fixture_backend')
            conn.execute('GRANT USAGE ON ALL SEQUENCES IN SCHEMA haycupo TO fixture_backend')
            conn.execute("INSERT INTO haycupo.usuario(nombre,correo,contrasena,fecha_nacimiento) VALUES ('Perfil sintético','legacy@example.com','legacy-fixture-only','2000-01-01')")
            conn.execute('INSERT INTO haycupo.publicacion(id_usuario) VALUES (1)')
            conn.execute('INSERT INTO haycupo.imagen_publicacion(id_publicacion) VALUES (1)')
            conn.execute('INSERT INTO haycupo.conexion(origen,destino) VALUES (1,1)')
            conn.execute("SET haycupo.jwt_backend_role='fixture_backend'")
            def execute_script(name):
                cursor = conn.execute((proposal / name).read_text(encoding='utf-8'))
                while cursor.nextset():
                    pass
            execute_script('01-preflight.sql')
            # Incompatibility aborts all DDL and preserves original accounts.
            conn.execute("INSERT INTO haycupo.usuario(nombre,correo) VALUES ('Duplicado sintético',' LEGACY@example.com ')")
            try:
                execute_script('02-email-verification.sql')
            except psycopg.Error:
                conn.execute('ROLLBACK')
                check(conn.execute("SELECT count(*) FROM information_schema.columns WHERE table_schema='haycupo' AND table_name='usuario' AND column_name='verificado'").fetchone()[0] == 0)
                check(conn.execute("SELECT to_regclass('haycupo.codigo_verificacion')").fetchone()[0] is None)
            else:
                raise AssertionError('Duplicate emails must abort the migration')
            conn.execute("DELETE FROM haycupo.usuario WHERE correo=' LEGACY@example.com '")
            execute_script('02-email-verification.sql')
            execute_script('03-postflight.sql')
            check(conn.execute('SELECT id_usuario,verificado,contrasena FROM haycupo.usuario').fetchone() == (1, False, 'legacy-fixture-only'))
            check(all(conn.execute(sql.SQL('SELECT count(*) FROM haycupo.{}').format(sql.Identifier(t))).fetchone()[0] == 1 for t in ('usuario','publicacion','imagen_publicacion','conexion')))
            check(conn.execute("SELECT count(*) FROM pg_class WHERE oid IN ('haycupo.codigo_verificacion'::regclass,'haycupo.sesion_jwt'::regclass) AND relrowsecurity").fetchone()[0] == 2)
            check(conn.execute("SELECT count(*) FROM pg_policies WHERE schemaname='haycupo' AND policyname='jwt_backend_only'").fetchone()[0] == 2)
            # Reapplication aborts safely; no object replacement.
            try:
                execute_script('02-email-verification.sql')
            except psycopg.Error:
                conn.execute('ROLLBACK')
                check(True)
            else:
                raise AssertionError('Migration must reject an existing JWT schema')
            # Backend app role exercises grants, identity sequence and RLS.
            conn.execute('SET ROLE fixture_backend')
            good = (1, 'a'*64)
            insert = "INSERT INTO haycupo.codigo_verificacion(id_usuario,codigo_hash,expira_en) VALUES (%s,%s,clock_timestamp()+interval '10 minutes')"
            conn.execute(insert, good)
            check(conn.execute('SELECT count(*) FROM haycupo.codigo_verificacion').fetchone()[0] == 1)
            rejected(conn, insert, good, '23505')
            rejected(conn, insert, (999,'a'*64), '23503')
            rejected(conn, insert, (1,'plaintext'), '23514')
            rejected(conn, 'UPDATE haycupo.codigo_verificacion SET intentos=-1', state='23514')
            rejected(conn, "UPDATE haycupo.codigo_verificacion SET expira_en=creado_en", state='23514')
            rejected(conn, "UPDATE haycupo.codigo_verificacion SET enviado_en=creado_en-interval '1 second'", state='23514')
            rejected(conn, 'DELETE FROM haycupo.codigo_verificacion', state='42501')
            rejected(conn, "INSERT INTO haycupo.sesion_jwt(jti,id_usuario,expira_en) VALUES ('invalid',1,clock_timestamp())", state='22P02')
            rejected(conn, "INSERT INTO haycupo.sesion_jwt(jti,id_usuario,expira_en) VALUES ('00000000-0000-0000-0000-000000000001',999,clock_timestamp())", state='23503')
            rejected(conn, "INSERT INTO haycupo.sesion_jwt(jti,id_usuario,expira_en) VALUES ('00000000-0000-0000-0000-000000000001',1,NULL)", state='23502')
            conn.execute('RESET ROLE')
            conn.execute('GRANT SELECT ON haycupo.codigo_verificacion TO fixture_client')
            conn.execute('SET ROLE fixture_client')
            check(conn.execute('SELECT count(*) FROM haycupo.codigo_verificacion').fetchone()[0] == 0)  # RLS, even with SELECT.
            rejected(conn, 'SELECT * FROM haycupo.sesion_jwt', state='42501')
            conn.execute('RESET ROLE')
            conn.execute('REVOKE SELECT ON haycupo.codigo_verificacion FROM fixture_client')
            conn.execute('DELETE FROM haycupo.codigo_verificacion')

        # Real backend SQL/transacciones against this cluster, SMTP in memory.
        from fastapi.testclient import TestClient
        from backend.auth_service import main as auth, database
        from backend.main import main as web
        def backend_connect():
            c = psycopg.connect(dsn)
            c.execute('SET ROLE fixture_backend')
            return c
        database.conectar = backend_connect
        web.conectar = backend_connect
        delivered = []
        auth.enviar_codigo_verificacion = lambda correo, nombre, code: delivered.append(code) or True
        payload = dict(nombre='Cuenta de prueba', correo='auth@example.com', contrasena='test-only-password', fecha_nacimiento='2000-01-01')
        # No lifespan: the minimal synthetic business tables intentionally omit
        # unrelated publication columns and no image directories are initialized.
        with nullcontext(TestClient(web.app)) as client:
            check(client.post('/auth/registro', json=payload).status_code == 200)
            check(client.post('/auth/registro', json={**payload,'contrasena':'replacement-test-only'}).status_code == 429)
            check(client.post('/auth/login', json=payload).status_code == 403)
            check(client.post('/auth/verificar', json={'correo':payload['correo'],'codigo':'notdigits'}).status_code == 422)
            wrong = '000000' if delivered[0] != '000000' else '111111'
            check(client.post('/auth/verificar', json={'correo':payload['correo'],'codigo':wrong}).status_code == 400)
            with psycopg.connect(dsn) as c:
                check(c.execute('SELECT intentos FROM haycupo.codigo_verificacion WHERE usado=false').fetchone()[0] == 1)
            check(client.post('/auth/verificar', json={'correo':payload['correo'],'codigo':delivered[0]}).status_code == 200)
            login = client.post('/auth/login', json=payload)
            check(login.status_code == 200)
            headers = {'Authorization':'Bearer '+login.json()['access_token']}
            check(client.get('/api/perfil', headers=headers).status_code == 200)
            check(client.get('/api/perfil', cookies={'roomies_id':'1'}).status_code == 401)
            check(client.post('/auth/logout', headers=headers).status_code == 200)
            check(client.get('/api/perfil', headers=headers).status_code == 401)
            check(client.post('/auth/login', json={'correo':'legacy@example.com','contrasena':'legacy-fixture-only'}).status_code == 401)
            auth.enviar_codigo_verificacion = lambda *a: False
            check(client.post('/auth/registro', json={**payload,'correo':'smtp-failure@example.com'}).status_code == 503)
            with psycopg.connect(dsn) as c:
                check(c.execute("SELECT usado,enviado_en FROM haycupo.codigo_verificacion c JOIN haycupo.usuario u USING(id_usuario) WHERE u.correo='smtp-failure@example.com'").fetchone() == (True,None))
            auth.enviar_codigo_verificacion = lambda correo, nombre, code: delivered.append(code) or True
            original_digest = auth.huella_codigo
            auth.huella_codigo = lambda *a: 'invalid-hmac'
            check(client.post('/auth/registro', json={**payload,'correo':'rollback@example.com'}).status_code == 503)
            auth.huella_codigo = original_digest
            with psycopg.connect(dsn) as c:
                check(c.execute("SELECT count(*) FROM haycupo.usuario WHERE correo='rollback@example.com'").fetchone()[0] == 0)
            # Serialization and attempt persistence on actual PostgreSQL.
            from concurrent.futures import ThreadPoolExecutor
            def signup(_):
                return client.post('/auth/registro', json={**payload,'correo':'parallel@example.com'}).status_code
            with ThreadPoolExecutor(max_workers=2) as pool:
                check(sorted(pool.map(signup, range(2))) == [200,429])
            incorrect = '000000' if delivered[-1] != '000000' else '111111'
            for expected in (400,400,400,400,429):
                check(client.post('/auth/verificar',json={'correo':'parallel@example.com','codigo':incorrect}).status_code == expected)
            with psycopg.connect(dsn) as c:
                check(c.execute("SELECT intentos,usado FROM haycupo.codigo_verificacion c JOIN haycupo.usuario u USING(id_usuario) WHERE u.correo='parallel@example.com'").fetchone() == (5,True))
                c.execute("UPDATE haycupo.codigo_verificacion SET creado_en=clock_timestamp()-interval '2 minutes' WHERE id_usuario=(SELECT id_usuario FROM haycupo.usuario WHERE correo='parallel@example.com')")
            # Repeat registration after cooldown does not change password.
            check(client.post('/auth/registro',json={**payload,'correo':'parallel@example.com','contrasena':'replacement-fixture'}).status_code == 200)
            check(client.post('/auth/verificar',json={'correo':'parallel@example.com','codigo':delivered[-1]}).status_code == 200)
            check(client.post('/auth/login',json={**payload,'correo':'parallel@example.com'}).status_code == 200)
            check(client.post('/auth/login',json={**payload,'correo':'parallel@example.com','contrasena':'replacement-fixture'}).status_code == 401)
        print(f'PASS: {checks} PostgreSQL/backend assertions; preflight, migration and postflight executed only in disposable cluster.')
    finally:
        if started:
            run('pg_ctl', '-D', data, '-m', 'immediate', '-w', 'stop')
