"""Ejecutar: .venv/Scripts/python.exe -I -B backend/tests/run_isolated.py
No importa la aplicación hasta eliminar el entorno heredado y bloquear I/O real.
"""
import os
import sys
import secrets
from pathlib import Path

root = Path(__file__).resolve().parents[2]
keep = {k: v for k, v in os.environ.items() if k.upper() in {"SYSTEMROOT", "WINDIR", "TEMP", "TMP", "COMSPEC"}}
os.environ.clear()
os.environ.update(keep)
os.environ.update({"HAYCUPO_ISOLATED_TESTS": "1", "PYTEST_DISABLE_PLUGIN_AUTOLOAD": "1",
                   "AUTH_JWT_ENABLED": "true", "JWT_SECRET_KEY": secrets.token_hex(32),
                   "AUTH_CODE_SECRET": secrets.token_hex(32)})
sys.path.insert(0, str(root))
sys.dont_write_bytecode = True

import socket
import threading
import smtplib
import dotenv
import psycopg
import sqlalchemy

blocked_calls = []


def deny(label):
    def blocked(*args, **kwargs):
        blocked_calls.append(label)
        raise RuntimeError(f"I/O real bloqueado por pruebas: {label}")
    return blocked


dotenv.load_dotenv = lambda *args, **kwargs: False
dotenv.dotenv_values = deny("dotenv_values")
# asyncio en Windows necesita un socketpair interno para despertar su loop.
# Solo su construcción, en ese hilo y hacia loopback, puede usar connect.
# Los conectores PostgreSQL/SMTP siguen bloqueados incluso hacia localhost.
original_connect, original_pair = socket.socket.connect, socket.socketpair
pair_scope = threading.local()


def local_pair(*args, **kwargs):
    pair_scope.active = True
    try:
        return original_pair(*args, **kwargs)
    finally:
        pair_scope.active = False


def guarded_connect(sock, address):
    if getattr(pair_scope, "active", False) and address[0] in {"127.0.0.1", "::1"}:
        return original_connect(sock, address)
    return deny("socket.connect")(sock, address)


socket.socketpair = local_pair
socket.socket.connect = guarded_connect
socket.socket.connect_ex = deny("socket.connect_ex")
socket.socket.sendto = deny("socket.sendto")
socket.create_connection = deny("socket.create_connection")
psycopg.connect = deny("psycopg.connect")
sqlalchemy.create_engine = deny("sqlalchemy.create_engine")
smtplib.SMTP = deny("SMTP")
smtplib.SMTP_SSL = deny("SMTP_SSL")

import pytest

result = pytest.main([str(root / "backend/tests"), "-q", "-p", "no:cacheprovider", *sys.argv[1:]])
if blocked_calls:
    print("FALLO: se intentó I/O real:", ", ".join(blocked_calls))
    result = 1
raise SystemExit(result)
