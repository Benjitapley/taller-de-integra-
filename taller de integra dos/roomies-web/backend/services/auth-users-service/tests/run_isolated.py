"""Ejecutar con python -I -B tests/run_isolated.py; no permite red externa."""
import os
import socket
import sys
import threading
from pathlib import Path

root = Path(__file__).resolve().parents[1]
keep = {key: value for key, value in os.environ.items()
        if key.upper() in {"SYSTEMROOT", "WINDIR", "TEMP", "TMP", "COMSPEC"}}
os.environ.clear()
os.environ.update(keep)
os.environ["PYTEST_DISABLE_PLUGIN_AUTOLOAD"] = "1"
sys.path.insert(0, str(root))
sys.dont_write_bytecode = True
blocked_calls = []


def deny(*args, **kwargs):
    blocked_calls.append("socket")
    raise RuntimeError("Conexión real bloqueada en pruebas aisladas.")


# asyncio necesita un socketpair interno en Windows, únicamente durante su creación.
original_pair, original_connect = socket.socketpair, socket.socket.connect
scope = threading.local()


def local_pair(*args, **kwargs):
    scope.active = True
    try:
        return original_pair(*args, **kwargs)
    finally:
        scope.active = False


def guarded_connect(sock, address):
    if getattr(scope, "active", False) and address[0] in {"127.0.0.1", "::1"}:
        return original_connect(sock, address)
    return deny()


socket.socketpair = local_pair
socket.socket.connect = guarded_connect
socket.socket.connect_ex = deny
socket.socket.sendto = deny
socket.create_connection = deny
socket.getaddrinfo = deny

import psycopg
psycopg.connect = deny
import pytest

result = pytest.main([str(root / "tests"), "--rootdir", str(root), "--confcutdir", str(root),
                      "--import-mode=importlib", "-q", "-p", "no:cacheprovider", *sys.argv[1:]])
forbidden = [name for name in sys.modules if name == "backend" or name.startswith("backend.")
             or name.split(".")[0] in {"sqlalchemy", "supabase"}]
if blocked_calls or forbidden:
    print("FALLO: intento de red real o importación prohibida:", len(blocked_calls), forbidden)
    result = 1
raise SystemExit(result)
