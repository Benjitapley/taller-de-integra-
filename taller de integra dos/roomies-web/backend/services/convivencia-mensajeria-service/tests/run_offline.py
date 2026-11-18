"""Contrato HTTP y adaptadores con transporte simulado; no acredita PostgreSQL."""
import os
from pathlib import Path
import socket
import sys

service = Path(__file__).resolve().parents[1]
keep = {k: v for k, v in os.environ.items() if k.upper() in {"SYSTEMROOT", "WINDIR", "TEMP", "TMP", "COMSPEC"}}
os.environ.clear()
os.environ.update(keep)
os.environ["PYTEST_DISABLE_PLUGIN_AUTOLOAD"] = "1"
os.environ["ROOMIES_LOCAL_MODE"] = "1"
os.environ["ROOMIES_RUNTIME_MODE"] = "disposable"
os.environ["ROOMIES_INTERNAL_TOKEN"] = "isolated-test-service-key-000000000000"
sys.path[:0] = [str(service), str(service.parents[2])]
sys.dont_write_bytecode = True
original_connect = socket.socket.connect


def connect(sock, address):
    if isinstance(address, tuple) and address[0] in {"127.0.0.1", "::1"}:
        return original_connect(sock, address)
    raise AssertionError("Las pruebas HTTP no permiten red externa.")


socket.socket.connect = connect
import psycopg
psycopg.connect = lambda *a, **k: (_ for _ in ()).throw(AssertionError("SQL no permitido en pruebas HTTP."))
import pytest
raise SystemExit(pytest.main([str(service / "tests/test_http.py"), str(service / "tests/test_ports.py"),
                             "--rootdir", str(service), "--confcutdir", str(service), "--import-mode=importlib",
                             "-q", "-p", "no:cacheprovider", *sys.argv[1:]]))
