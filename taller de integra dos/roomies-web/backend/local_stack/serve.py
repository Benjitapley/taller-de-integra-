"""Arranque exclusivo del runner desechable, con barreras de red y dotenv."""
import json
import os
from pathlib import Path
import socket
import sys

if os.environ.get("ROOMIES_LOCAL_MODE")!="1" or os.environ.get("ROOMIES_TEST_RUNNER")!="disposable-only":
    raise RuntimeError("Usa run_stack.py")
root=Path(__file__).resolve().parents[2]
services={"auth":"backend/services/auth-users-service","listado":"backend/services/listado-applications-service",
          "match":"backend/services/match-conexion-service","gateway":"backend/api-gateway"}
service=sys.argv[1]
if service not in services: raise RuntimeError("Servicio inválido")
sys.path[:0]=[str(root/services[service]),str(root)]
sys.dont_write_bytecode=True
ports=set(json.loads(os.environ["ROOMIES_ALLOWED_PORTS"]))
connect=socket.socket.connect
import threading
scope=threading.local()
pair=socket.socketpair
def local_pair(*args,**kwargs):
    scope.internal=True
    try: return pair(*args,**kwargs)
    finally: scope.internal=False
socket.socketpair=local_pair
def local_connect(sock,address):
    if getattr(scope,"internal",False) and isinstance(address,tuple) and address[0] in {"127.0.0.1","::1"}:
        return connect(sock,address)
    if not isinstance(address,tuple) or address[0] not in {"127.0.0.1","::1"} or address[1] not in ports:
        raise RuntimeError("Conexión fuera del entorno desechable")
    return connect(sock,address)
socket.socket.connect=local_connect
socket.socket.connect_ex=lambda *a,**k: (_ for _ in ()).throw(RuntimeError("connect_ex bloqueado"))
resolution=socket.getaddrinfo
def local_resolution(host,*args,**kwargs):
    if host not in {"127.0.0.1","localhost","::1",None}: raise RuntimeError("DNS externo bloqueado")
    return resolution(host,*args,**kwargs)
socket.getaddrinfo=local_resolution
def audit(event,args):
    if event=="open" and isinstance(args[0],(str,bytes)):
        name=Path(os.fsdecode(args[0])).name
        if name==".env" or name.startswith(".env."): raise RuntimeError("dotenv bloqueado")
sys.addaudithook(audit)
import psycopg
original_connect=psycopg.connect
variables={"auth":"AUTH_USERS_DATABASE_URL","listado":"LISTADO_DATABASE_URL","match":"MATCH_DATABASE_URL"}
def database(conninfo="",**kwargs):
    if service not in variables or conninfo!=os.environ[variables[service]] or set(kwargs)-{"row_factory","connect_timeout","prepare_threshold"}:
        raise RuntimeError("Base o rol fuera del servicio")
    return original_connect(conninfo,**kwargs)
psycopg.connect=database
import uvicorn
uvicorn.run("app.main:app",host="127.0.0.1",port=int(os.environ["ROOMIES_PORT"]),access_log=False,log_level="warning",proxy_headers=False)
