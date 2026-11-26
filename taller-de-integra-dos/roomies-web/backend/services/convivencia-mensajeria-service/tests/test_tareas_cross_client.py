"""BFF TS → Gateway HTTP → API/SQL reales → adaptador móvil TS → BFF.

Identidad inyectada solo en esta instancia de prueba; no prueba Supabase/Expo.
Ejecutar mediante run_isolated.py, sin bases ni cuentas externas.
"""
from contextlib import contextmanager
import importlib.util
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import threading
import time
from types import SimpleNamespace

from fastapi import Header, HTTPException
import psycopg
import uvicorn

from app.main import create_app, confirmed_actor, access_token
from .test_tareas_sql import rental  # fixture SQL compartida, no datos remotos


@contextmanager
def serving(application):
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        listener.listen(128)
        server = uvicorn.Server(uvicorn.Config(application, log_config=None, access_log=False, log_level="critical"))
        thread = threading.Thread(target=server.run, kwargs={"sockets": [listener]}, daemon=True)
        thread.start()
        try:
            deadline = time.monotonic() + 10
            while not server.started:
                assert thread.is_alive() and time.monotonic() < deadline, "Servidor local no inició"
                time.sleep(.01)
            yield f"http://127.0.0.1:{listener.getsockname()[1]}"
        finally:
            server.should_exit = True
            thread.join(timeout=10)
            assert not thread.is_alive(), "Servidor local no terminó"


def test_bff_gateway_sql_y_adaptador_movil_cruzados(service, rental, migrated_database):
    root = Path(__file__).resolve().parents[4]
    frontend = root / "frontend-next"
    node = shutil.which("node")
    assert node and (frontend / "node_modules/typescript").is_dir(), "Requiere Node y dependencias web instaladas"
    application = create_app(service, run_recovery=False)

    def fixture_actor(authorization: str = Header(default="")):
        actors = {f"Bearer e04.actor-{user}.fixture": user for user in (2, 3, 99)}
        if authorization not in actors:
            raise HTTPException(401)
        return SimpleNamespace(user_id=actors[authorization])

    application.dependency_overrides[confirmed_actor] = fixture_actor
    application.dependency_overrides[access_token] = lambda: "e04.fixture.token"
    # Nombre distinto para no colisionar con el paquete app de Convivencia.
    package = root / "backend/api-gateway/app"
    spec = importlib.util.spec_from_file_location("e04_fixture_gateway", package / "__init__.py",
                                                 submodule_search_locations=[str(package)])
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    from e04_fixture_gateway.config import Settings
    from e04_fixture_gateway.main import create_app as gateway_app

    with serving(application) as upstream:
        with serving(gateway_app(Settings(local_mode=True, convivencia_upstream=upstream))) as gateway:
            environment = {key: value for key, value in os.environ.items() if key.upper() in
                           {"SYSTEMROOT", "WINDIR", "TEMP", "TMP", "COMSPEC", "PATH", "PATHEXT"}}
            environment["E04_TEST_GATEWAY"] = gateway

            def driver():
                result = subprocess.run([node, str(frontend / "tests/tareas-cross-client.mjs")],
                    cwd=frontend, env=environment, capture_output=True, text=True, timeout=60,
                    creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
                assert result.returncode == 0, result.stdout + result.stderr
                return json.loads(result.stdout)

            first = driver()
            assert first["paginated"] == 22
            # El retiro utiliza el rol restringido y ejecuta el trigger real.
            with psycopg.connect(os.environ["CONVIVENCIA_DATABASE_URL"]) as connection:
                connection.execute("UPDATE convivencia_mensajeria.pertenencia SET estado='Inactiva' WHERE id_arriendo=%s AND id_usuario=3", (rental,))
            environment["E04_TEST_RETIRED_TASK"] = str(first["pending"])
            assert driver() == {"retired403": True, "unassigned": True, "reassigned": True}
    with psycopg.connect(migrated_database) as connection:
        assert connection.execute("SELECT estado,fecha_completada IS NOT NULL FROM convivencia_mensajeria.tarea WHERE id_tarea=%s",
                                  (first["completed"],)).fetchone() == ("Completada", True)
