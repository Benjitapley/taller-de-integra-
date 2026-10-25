"""Real HTTP + browser + PostgreSQL + STARTTLS SMTP, all disposable/loopback.
No env files are copied/read. No project server or existing DB is used.
"""
import argparse
from datetime import datetime, timedelta, timezone
from email import policy
from email.parser import BytesParser
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import ipaddress
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import socket
import ssl
import subprocess
import sys
import tempfile
import threading
import time
from urllib.request import ProxyHandler, build_opener

# Diagnostic output from Next contains Unicode even on Windows cp1252 consoles.
sys.stdout.reconfigure(encoding='utf-8', errors='replace')
sys.stderr.reconfigure(encoding='utf-8', errors='replace')

ROOT = Path(__file__).resolve().parents[2]
FRONT = ROOT / 'frontend-next'
HERE = Path(__file__).resolve().parent
parser = argparse.ArgumentParser()
parser.add_argument('--pg-bin', required=True)
parser.add_argument('--node', required=True)
parser.add_argument('--playwright', required=True, help='Absolute path to installed Playwright package')
parser.add_argument('--browser', required=True, help='Installed Chromium/Edge binary; never uses a personal profile')
args = parser.parse_args()
for supplied in (args.pg_bin, args.node, args.playwright, args.browser):
    if not Path(supplied).exists():
        raise RuntimeError('Missing local test dependency: ' + supplied)

base_env = {k: v for k, v in os.environ.items() if k.upper() in {'SYSTEMROOT','WINDIR','TEMP','TMP','COMSPEC','PATHEXT'}}
base_env['PATH'] = str(Path(args.node).parent) + os.pathsep + str(Path(base_env.get('SYSTEMROOT', 'C:/Windows')) / 'System32')
os.environ.clear()
os.environ.update(base_env)
sys.dont_write_bytecode = True

def audit(event, values):
    if event == 'open' and isinstance(values[0], (str, bytes)):
        name = Path(os.fsdecode(values[0])).name
        if name == '.env' or name.startswith('.env.'):
            raise RuntimeError('E2E: dotenv reads forbidden')
sys.addaudithook(audit)

import psycopg
from psycopg import sql
import jwt
from aiosmtpd.controller import Controller
from aiosmtpd.smtp import AuthResult, LoginPassword
from cryptography import x509
from cryptography.x509.oid import NameOID
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa

def free_port():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]

def command(exe, *arguments):
    # File handles prevent descendants from holding communicate() pipes open.
    with tempfile.TemporaryFile() as log:
        completed = subprocess.run([str(exe), *map(str, arguments)], env=base_env,
                                   stdout=log, stderr=log, timeout=60, creationflags=subprocess.CREATE_NO_WINDOW)
        log.seek(0)
        output = log.read().decode('utf-8', errors='replace')
    if completed.returncode:
        raise RuntimeError(output)

def stop(process):
    if process.poll() is None:
        # Only a PID created/retained by this runner; includes Next worker children.
        command(Path(base_env['SYSTEMROOT']) / 'System32/taskkill.exe', '/PID', process.pid, '/T', '/F')
        process.wait(timeout=15)

def wait_http(url, process):
    opener = build_opener(ProxyHandler({}))
    for _ in range(180):
        if process.poll() is not None:
            raise RuntimeError('Local test server exited before readiness: ' + url)
        try:
            with opener.open(url, timeout=1) as response:
                if response.status == 200:
                    return
        except Exception:
            pass
        time.sleep(.25)
    raise RuntimeError('Local test server did not become ready: ' + url)

class Mailbox:
    def __init__(self):
        self.codes = {}
        self.fail = False
        self.deliveries = 0

    async def handle_DATA(self, server, session, envelope):
        if self.fail:
            return '451 4.3.0 Synthetic SMTP failure'
        if not session.ssl or not session.authenticated:
            return '530 5.7.0 TLS and fixture authentication required'
        message = BytesParser(policy=policy.default).parsebytes(envelope.original_content)
        match = re.search(r'código de verificación es ([0-9]{6})', message.get_body(preferencelist=('plain',)).get_content())
        if not match or any(not address.endswith('@example.com') for address in envelope.rcpt_tos):
            return '550 5.1.0 Synthetic recipients only'
        for recipient in envelope.rcpt_tos:
            self.codes.setdefault(recipient, []).append(match[1])
        self.deliveries += 1
        return '250 2.0.0 Captured locally; never relayed'

with tempfile.TemporaryDirectory(prefix='haycupo-e2e-') as temporary:
    fixture = Path(temporary).resolve()
    pgdata = fixture / 'postgres'
    ports = set()
    while len(ports) < 4:
        ports.add(free_port())
    pg_port, api_port, web_port, smtp_port = sorted(ports)
    web_origin, api_origin = f'http://127.0.0.1:{web_port}', f'http://127.0.0.1:{api_port}'
    pg_ctl = Path(args.pg_bin) / 'pg_ctl.exe'
    processes, logs = [], []
    application = None
    controller = control = None
    cleanup_errors = []
    mailbox = Mailbox()
    pg_password, jwt_secret, code_secret, control_key = [secrets.token_hex(32) for _ in range(4)]
    smtp_user, smtp_password = 'smtp-fixture@example.com', secrets.token_hex(24)
    owner_dsn = f'host=127.0.0.1 port={pg_port} user=e2e_owner dbname=postgres connect_timeout=3'
    app_dsn = f'postgresql://e2e_backend:{pg_password}@127.0.0.1:{pg_port}/postgres'
    try:
        command(Path(args.pg_bin) / 'initdb.exe', '-D', pgdata, '-U', 'e2e_owner', '--auth-local=trust', '--auth-host=trust', '--encoding=UTF8', '--no-locale')
        command(pg_ctl, '-D', pgdata, '-l', fixture / 'postgres.log', '-o', f'-h 127.0.0.1 -p {pg_port}', '-w', 'start')
        # All rows and business tables are synthetic. Real lifespan is exercised.
        with psycopg.connect(owner_dsn, autocommit=True) as conn:
            conn.execute(sql.SQL('CREATE ROLE e2e_backend LOGIN NOSUPERUSER NOBYPASSRLS PASSWORD {}').format(sql.Literal(pg_password)))
            conn.execute('CREATE SCHEMA haycupo')
            conn.execute('''CREATE TABLE haycupo.usuario (
                id_usuario bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                nombre text, correo text, contrasena text, fecha_nacimiento date,
                presupuesto numeric, zona_interes text, ocupacion text, edad integer,
                ciudad text, biografia text, foto_perfil text, breve_descripcion text, sobre_mi text)''')
            conn.execute('''CREATE TABLE haycupo.publicacion (
                id_publicacion bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                id_usuario bigint NOT NULL REFERENCES haycupo.usuario(id_usuario),
                tipo text, titulo text, descripcion text, precio numeric(14,2), ubicacion text,
                estado text, cupos_totales integer, categoria text, tipo_vivienda text,
                permitir_comentarios boolean DEFAULT false, mascota text, contenido text)''')
            conn.execute('''CREATE TABLE haycupo.imagen_publicacion (
                id_imagen bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                id_publicacion bigint REFERENCES haycupo.publicacion(id_publicacion), url text, orden integer)''')
            conn.execute('''CREATE TABLE haycupo.conexion (
                id_conexion bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                "id_solicitante_FK" bigint REFERENCES haycupo.usuario(id_usuario),
                "id_receptor_FK" bigint REFERENCES haycupo.usuario(id_usuario), estado text, fecha_solicitud timestamp)''')
            conn.execute('GRANT USAGE ON SCHEMA haycupo TO e2e_backend')
            conn.execute('GRANT SELECT,INSERT,UPDATE,DELETE ON ALL TABLES IN SCHEMA haycupo TO e2e_backend')
            conn.execute('GRANT USAGE ON ALL SEQUENCES IN SCHEMA haycupo TO e2e_backend')
            conn.execute("SET haycupo.jwt_backend_role='e2e_backend'")
            for name in ('01-preflight.sql','02-email-verification.sql','03-postflight.sql'):
                cursor = conn.execute((ROOT / 'migration-proposals/SCRUM-72' / name).read_text(encoding='utf-8'))
                while cursor.nextset():
                    pass
        print('PASS migration V2, preflight and postflight on disposable PostgreSQL', flush=True)

        # A private, short-lived CA/cert supports the real SMTP STARTTLS path.
        key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
        subject = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'Haycupo disposable SMTP')])
        now = datetime.now(timezone.utc)
        certificate = (x509.CertificateBuilder().subject_name(subject).issuer_name(subject)
                       .public_key(key.public_key()).serial_number(x509.random_serial_number())
                       .not_valid_before(now-timedelta(minutes=1)).not_valid_after(now+timedelta(days=1))
                       .add_extension(x509.BasicConstraints(ca=True,path_length=0),critical=True)
                       .add_extension(x509.SubjectAlternativeName([x509.IPAddress(ipaddress.ip_address('127.0.0.1'))]),critical=False)
                       .sign(key,hashes.SHA256()))
        cert_file, key_file = fixture / 'smtp-ca.pem', fixture / 'smtp-key.pem'
        cert_file.write_bytes(certificate.public_bytes(serialization.Encoding.PEM))
        key_file.write_bytes(key.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,serialization.NoEncryption()))
        tls = ssl.SSLContext(ssl.PROTOCOL_TLS_SERVER)
        tls.load_cert_chain(cert_file,key_file)
        def authenticate(server, session, envelope, mechanism, auth_data):
            valid = isinstance(auth_data,LoginPassword) and secrets.compare_digest(auth_data.login,smtp_user.encode()) and secrets.compare_digest(auth_data.password,smtp_password.encode())
            return AuthResult(success=valid,handled=False)
        controller = Controller(mailbox,hostname='127.0.0.1',port=smtp_port,tls_context=tls,
                                require_starttls=True,auth_required=True,authenticator=authenticate)
        controller.start()

        # Driver-only fixture control. Never added to FastAPI/Next production APIs.
        class Control(BaseHTTPRequestHandler):
            def log_message(self,*a):
                pass
            def do_POST(self):
                if self.path != '/fixture' or self.headers.get('Authorization') != 'Bearer '+control_key:
                    self.send_error(403)
                    return
                payload = json.loads(self.rfile.read(min(int(self.headers.get('Content-Length','0')),16384)))
                action, correo = payload.get('action'), payload.get('correo')
                result = {}
                with psycopg.connect(owner_dsn) as c:
                    if action == 'mail':
                        result = {'codes':mailbox.codes.get(correo,[]),'deliveries':mailbox.deliveries}
                    elif action == 'cooldown':
                        c.execute("UPDATE haycupo.codigo_verificacion SET creado_en=creado_en-interval '61 seconds' WHERE id_usuario=(SELECT id_usuario FROM haycupo.usuario WHERE correo=%s)",(correo,))
                    elif action == 'smtp-fail':
                        mailbox.fail = bool(payload['enabled'])
                    elif action in {'session-state','revoke','expire'}:
                        token = payload['token']
                        claims = jwt.decode(token,jwt_secret,algorithms=['HS256'],audience='haycupo-clients',issuer='haycupo-api',options={'verify_exp':False})
                        if action == 'revoke':
                            c.execute('UPDATE haycupo.sesion_jwt SET revocado=true WHERE jti=%s',(claims['jti'],))
                        elif action == 'expire':
                            claims.update(iat=int(time.time())-70,exp=int(time.time())-10)
                            result = {'token':jwt.encode(claims,jwt_secret,algorithm='HS256')}
                        else:
                            row = c.execute('SELECT revocado FROM haycupo.sesion_jwt WHERE jti=%s',(claims['jti'],)).fetchone()
                            result = {'revoked':row[0] if row else None}
                    elif action == 'db-state':
                        row = c.execute('SELECT id_usuario,verificado,contrasena FROM haycupo.usuario WHERE correo=%s',(correo,)).fetchone()
                        code = c.execute('SELECT intentos,usado,enviado_en IS NOT NULL FROM haycupo.codigo_verificacion WHERE id_usuario=%s ORDER BY id DESC LIMIT 1',(row[0],)).fetchone() if row else None
                        result = {'exists':row is not None,'verified':row[1] if row else None,'argon2':bool(row and row[2].startswith('$argon2id$')),'attempts':code[0] if code else None,'used':code[1] if code else None,'delivered':code[2] if code else None}
                    else:
                        self.send_error(400)
                        return
                body = json.dumps(result).encode()
                self.send_response(200)
                self.send_header('Content-Type','application/json')
                self.send_header('Content-Length',str(len(body)))
                self.end_headers()
                self.wfile.write(body)
        control = ThreadingHTTPServer(('127.0.0.1',0),Control)
        control_thread = threading.Thread(target=control.serve_forever,daemon=True)
        control_thread.start()

        def launch(executable,arguments,environment,name,cwd):
            log = (fixture / f'{name}.log').open('wb')
            logs.append(log)
            process = subprocess.Popen([str(executable),*map(str,arguments)],env=environment,cwd=cwd,
                                       stdout=log,stderr=log,creationflags=subprocess.CREATE_NO_WINDOW)
            processes.append(process)
            return process
        api_env = {**base_env,'HAYCUPO_E2E':'isolated-disposable','DATABASE_URL':app_dsn,
                   'AUTH_JWT_ENABLED':'true','JWT_SECRET_KEY':jwt_secret,'AUTH_CODE_SECRET':code_secret,
                   'JWT_EXPIRATION_MINUTES':'15','SMTP_HOST':'127.0.0.1','SMTP_PORT':str(smtp_port),
                   'SMTP_USER':smtp_user,'SMTP_PASSWORD':smtp_password,'SSL_CERT_FILE':str(cert_file),
                   'E2E_API_PORT':str(api_port),'E2E_IMAGE_DIR':str(fixture / 'images'),'WEB_ORIGINS':web_origin}
        api = launch(sys.executable,['-I','-B',HERE / 'backend_server.py'],api_env,'fastapi',ROOT)
        wait_http(api_origin+'/openapi.json',api)

        application = Path(tempfile.mkdtemp(prefix='.proxy-test-e2e-',dir=FRONT)).resolve()
        for name in ('src','public','package.json','tsconfig.json','next.config.ts'):
            origin, target = FRONT / name, application / name
            if origin.is_dir():
                shutil.copytree(origin,target)
            else:
                shutil.copyfile(origin,target)
        command(args.node,'-e',"require('node:fs').symlinkSync(process.argv[1],process.argv[2],'junction')",FRONT / 'node_modules',application / 'node_modules')
        next_env = {**base_env,'WEB_AUTH_ENABLED':'true','WEB_AUTH_ORIGIN':web_origin,'WEB_AUTH_FASTAPI_ORIGIN':api_origin,
                    'FASTAPI_ORIGIN':api_origin,'NEXT_TELEMETRY_DISABLED':'1','NODE_OPTIONS':'--require='+str(HERE / 'network-guard.cjs')}
        web = launch(args.node,[FRONT / 'node_modules/next/dist/bin/next','dev','--hostname','127.0.0.1','--port',str(web_port)],next_env,'next',application)
        wait_http(web_origin+'/',web)
        print('PASS isolated FastAPI lifespan, local STARTTLS SMTP and Next.js started',flush=True)

        browser_config = {'web':web_origin,'playwright':str(Path(args.playwright).resolve()),'browser':str(Path(args.browser).resolve()),
                          'control':f'http://127.0.0.1:{control.server_address[1]}/fixture','controlKey':control_key}
        result_file = fixture / 'browser-result.json'
        driver = launch(args.node,[HERE / 'browser.mjs',result_file],base_env,'browser',ROOT)
        # JSON travels over a temporary file accessible only to the fixture driver,
        # never through Next.js or the browser's application environment.
        # The driver waits for this generated file (no inherited .env).
        (fixture / 'browser-config.json').write_text(json.dumps(browser_config),encoding='utf-8')
        driver.wait(timeout=240)
        if result_file.exists():
            report = json.loads(result_file.read_text(encoding='utf-8'))
            for item in report['checks']:
                print(('PASS ' if item['passed'] else 'FAIL ')+item['name'],flush=True)
            print(f"Browser/HTTP checks: {sum(item['passed'] for item in report['checks'])}/{len(report['checks'])}; external browser requests: {report['externalRequests']}",flush=True)
        if driver.returncode:
            # Only fixture errors; driver never logs tokens/passwords/code values.
            print((fixture / 'browser.log').read_text(encoding='utf-8',errors='replace'),flush=True)
            raise RuntimeError('E2E browser assertions failed')
    except Exception:
        # Read only sanitized application startup errors. Never include env/SMTP data.
        for name in ('fastapi','next'):
            log_path = fixture / f'{name}.log'
            if log_path.exists():
                text = log_path.read_text(encoding='utf-8',errors='replace')[-6000:]
                for sensitive in (pg_password,jwt_secret,code_secret,smtp_password,control_key):
                    text = text.replace(sensitive,'[redacted]')
                print(f'{name} diagnostic:\n{text}',flush=True)
        raise
    finally:
        for process in reversed(processes):
            try:
                stop(process)
            except Exception as error:
                cleanup_errors.append(str(error))
        if control:
            control.shutdown()
            control.server_close()
        if controller:
            controller.stop()
        if (pgdata / 'postmaster.pid').exists():
            try:
                command(pg_ctl,'-D',pgdata,'-m','immediate','-w','stop')
            except Exception as error:
                cleanup_errors.append(str(error))
        for log in logs:
            log.close()
        if application:
            # Checked scope, remove dependency junction first, never walk real modules.
            if application.parent != FRONT.resolve() or not application.name.startswith('.proxy-test-e2e-'):
                raise RuntimeError('Unsafe fixture cleanup path')
            link = application / 'node_modules'
            if link.exists():
                if link.resolve() != (FRONT / 'node_modules').resolve():
                    raise RuntimeError('Unexpected dependency junction target')
                os.rmdir(link)
            shutil.rmtree(application)
        if cleanup_errors:
            raise RuntimeError('Fixture cleanup failed: '+'; '.join(cleanup_errors))
        print('PASS cleanup: owned servers stopped; temporary app, cluster and credentials removed',flush=True)
