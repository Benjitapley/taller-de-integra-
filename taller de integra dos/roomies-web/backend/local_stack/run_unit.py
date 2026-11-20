"""Pruebas de reglas/casos de uso sin red ni bases de datos."""
import argparse
import os
from pathlib import Path
import socket
import sys

parser = argparse.ArgumentParser()
parser.add_argument("service", choices=["auth", "listado", "match", "runtime"])
args = parser.parse_args()
here = Path(__file__).resolve().parent
root = here.parents[1]
service = {"auth": "auth-users-service", "listado": "listado-applications-service", "match": "match-conexion-service", "runtime": "auth-users-service"}[args.service]
sys.path[:0] = [str(root / "backend/services" / service), str(root)]
keep = {key: value for key, value in os.environ.items() if key.upper() in {"SYSTEMROOT", "WINDIR", "TEMP", "TMP", "COMSPEC"}}
os.environ.clear()
os.environ.update(keep)
os.environ["PYTEST_DISABLE_PLUGIN_AUTOLOAD"] = "1"
sys.dont_write_bytecode = True

def deny(*_, **__): raise AssertionError("Red/SQL prohibidos en pruebas de dominio")
socket.create_connection = deny
socket.socket.connect = deny
socket.socket.connect_ex = deny
socket.getaddrinfo = deny
import psycopg
psycopg.connect = deny
import pytest
raise SystemExit(pytest.main([str(here / f"test_{args.service}.py"), "--rootdir", str(here), "--confcutdir", str(here), "--import-mode=importlib", "-q", "-p", "no:cacheprovider"]))
