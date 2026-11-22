"""Arranca Uvicorn real en loopback; verifica salud y rechazos sin SQL ni upstreams."""
import os
from pathlib import Path
import socket
import sys
import threading
import time

service = Path(__file__).resolve().parents[1]
keep = {k: v for k, v in os.environ.items() if k.upper() in
        {"SYSTEMROOT", "WINDIR", "TEMP", "TMP", "COMSPEC", "PATH"}}
os.environ.clear()
os.environ.update(keep)
os.environ["ROOMIES_LOCAL_MODE"] = "1"
os.environ["ROOMIES_RUNTIME_MODE"] = "disposable"
os.environ["ROOMIES_INTERNAL_TOKEN"] = "isolated-smoke-service-key-0000000000"
sys.path[:0] = [str(service), str(service.parents[2])]
sys.dont_write_bytecode = True

import httpx
import psycopg
import uvicorn
from app.main import create_app


def no_database(*args, **kwargs):
    raise AssertionError("SQL no permitido en smoke sin dependencias.")


psycopg.connect = no_database
listener = socket.socket()
listener.bind(("127.0.0.1", 0))
listener.listen()
port = listener.getsockname()[1]
server = uvicorn.Server(uvicorn.Config(create_app(run_recovery=False), host="127.0.0.1", port=port,
                                      log_level="critical", access_log=False, proxy_headers=False))
thread = threading.Thread(target=lambda: server.run(sockets=[listener]), daemon=True)
try:
    thread.start()
    deadline = time.monotonic() + 10
    while not server.started and time.monotonic() < deadline:
        time.sleep(0.02)
    assert server.started, "Uvicorn no inició dentro del plazo."
    with httpx.Client(base_url=f"http://127.0.0.1:{port}", trust_env=False, timeout=5) as client:
        checks = [
            (client.get("/health"), 200),
            (client.get("/api/arriendos/mio"), 401),
            (client.post("/internal/incorporaciones", json={"id_usuario": 2, "id_publicacion": 7,
                                                          "id_postulacion": 9, "version_capacidad": 1},
                         headers={"X-Roomies-Service": os.environ["ROOMIES_INTERNAL_TOKEN"],
                                  "Idempotency-Key": "c9c989c1-7f6a-48c0-8bab-000000000001"}), 503),
        ]
    for response, status in checks:
        assert response.status_code == status
        assert response.headers["Cache-Control"] == "no-store"
    assert checks[2][0].json()["code"] == "DEPENDENCY_UNAVAILABLE"
    print("PASS TCP Uvicorn loopback: health=200; GET sin sesión=401; POST sin dependencias=503; no-store en las 3 respuestas.")
    print("Alcance: sin SQL ni proveedores externos; no acredita admisión completa.")
finally:
    server.should_exit = True
    thread.join(timeout=5)
    listener.close()
