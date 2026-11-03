"""Subprocess entry point: fail closed, prohibit dotenv, DB/SMTP outside fixture."""
import os
import sys
from pathlib import Path
from urllib.parse import urlparse

if os.environ.get('HAYCUPO_E2E') != 'isolated-disposable':
    raise RuntimeError('Use run_e2e.py, never launch this file with project credentials')
dsn = os.environ['DATABASE_URL']
parsed = urlparse(dsn)
if parsed.hostname != '127.0.0.1' or parsed.username != 'e2e_backend' or parsed.path != '/postgres':
    raise RuntimeError('Only the generated local E2E database is allowed')

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))
import dotenv
dotenv.load_dotenv = lambda *a, **k: False
def forbidden(*a, **k):
    raise RuntimeError('E2E: external I/O or dotenv forbidden')
dotenv.dotenv_values = forbidden

# Protect against accidental direct reads in future imports too.
def audit(event, args):
    if event == 'open' and isinstance(args[0], (str, bytes)):
        name = Path(os.fsdecode(args[0])).name
        if name == '.env' or name.startswith('.env.'):
            forbidden()
sys.addaudithook(audit)

import socket
connect = socket.socket.connect
def local_connect(sock, address):
    if not isinstance(address, tuple) or address[0] not in {'127.0.0.1', '::1'}:
        forbidden()
    return connect(sock, address)
socket.socket.connect = local_connect
socket.socket.connect_ex = forbidden
socket.socket.sendto = forbidden
getaddrinfo = socket.getaddrinfo
def local_resolution(host, *args, **kwargs):
    if host not in {'127.0.0.1', '::1', 'localhost', None}:
        forbidden()
    return getaddrinfo(host, *args, **kwargs)
socket.getaddrinfo = local_resolution

import psycopg
real_connect = psycopg.connect
def local_database(conninfo='', **kwargs):
    if conninfo != dsn or set(kwargs) - {'connect_timeout'}:
        forbidden()
    return real_connect(dsn, **kwargs)
psycopg.connect = local_database

import smtplib
SMTP = smtplib.SMTP
class LocalSMTP(SMTP):
    def __init__(self, host='', port=0, *args, **kwargs):
        if host != '127.0.0.1' or port != int(os.environ['SMTP_PORT']):
            forbidden()
        super().__init__(host, port, *args, **kwargs)
smtplib.SMTP = LocalSMTP
smtplib.SMTP_SSL = forbidden

# Verify the barriers before importing the app. All attempts fail before I/O.
for probe in (
    lambda: dotenv.dotenv_values('.env'),
    lambda: open('.env', 'rb'),
    lambda: socket.getaddrinfo('blocked.invalid', 443),
    lambda: psycopg.connect('host=blocked.invalid dbname=postgres'),
    lambda: smtplib.SMTP('blocked.invalid', 587),
):
    try:
        probe()
    except RuntimeError:
        continue
    raise RuntimeError('An isolation guard did not reject its startup probe')
print('PASS backend isolation guards: dotenv, external DNS, database and SMTP blocked', flush=True)

from backend.main import main as web
if os.environ.get('HAYCUPO_MANUAL') == 'synthetic-only':
    from fastapi.responses import JSONResponse

    @web.app.middleware('http')
    async def synthetic_mail_only(request, call_next):
        # This entry point is test infrastructure; production never imports it.
        if request.url.path in {'/auth/registro', '/auth/login', '/auth/verificar', '/auth/reenviar-codigo'} and request.method == 'POST':
            try:
                data = await request.json()
                correo = data.get('correo') if isinstance(data, dict) else None
                if isinstance(correo, str) and not correo.strip().lower().endswith('@example.com'):
                    return JSONResponse({'detail': 'El entorno manual solo admite correos sintéticos @example.com.'}, status_code=422)
            except (ValueError, UnicodeError):
                pass  # FastAPI retains its normal malformed-input validation.
        return await call_next(request)

# Redirect both writes and static images to the fixture, including real lifespan.
web.IMAGENES = Path(os.environ['E2E_IMAGE_DIR'])
for route in web.app.routes:
    if getattr(route, 'path', None) == '/imagenes':
        route.app.directory = str(web.IMAGENES)
        route.app.all_directories = [str(web.IMAGENES)]

import uvicorn
uvicorn.run(web.app, host='127.0.0.1', port=int(os.environ['E2E_API_PORT']),
            access_log=False, log_level='warning')
