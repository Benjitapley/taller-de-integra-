"""Ejemplos ejecutados contra FastAPI y PostgreSQL; identidad y puertos externos inyectados."""
import json
from pathlib import Path
from types import SimpleNamespace
from uuid import uuid4

from fastapi.testclient import TestClient
import pytest

from app.main import create_app, confirmed_actor, access_token

pytestmark = pytest.mark.usefixtures("empty_database")


def test_e06_export_executed_examples(service, ports, request):
    ports[1].owned_by = lambda publication, actor, token: actor == 1
    for user in (2, 3):
        service.incorporate(uuid4(), {"id_usuario": user, "id_publicacion": 7, "id_postulacion": user, "version_capacidad": 1})
    app = create_app(service, run_recovery=False)
    person = [2]
    app.dependency_overrides[confirmed_actor] = lambda: SimpleNamespace(user_id=person[0], display_name="E06 ficticio")
    app.dependency_overrides[access_token] = lambda: "isolated"
    examples = []
    with TestClient(app) as client:
        def call(method, path, expected=200, **kwargs):
            response = client.request(method, path, **kwargs)
            assert response.status_code == expected, response.text
            examples.append({"method": method, "path": path, "actor_fixture": person[0],
                             "body": kwargs.get("json"), "status": response.status_code, "response": response.json()})
            return response.json()

        rental = call("GET", "/api/arriendos/mio")["id_arriendo"]
        call("GET", f"/api/arriendos/{rental}")
        page = call("GET", f"/api/arriendos/{rental}/integrantes?limite=1")
        assert page["siguiente_cursor"]
        call("GET", f"/api/arriendos/{rental}/integrantes?limite=1&cursor={page['siguiente_cursor']}")
        call("GET", f"/api/arriendos/{rental}/integrantes?cursor=invalid", 422)
        conversation = call("GET", "/api/conversaciones?limite=20")["items"][0]["id_conversacion"]
        call("GET", f"/api/conversaciones/{conversation}")
        for i in range(3):
            call("POST", f"/api/conversaciones/{conversation}/mensajes", json={"contenido": f"Mensaje ficticio {i}", "id_cliente": str(uuid4())})
        page = call("GET", f"/api/conversaciones/{conversation}/mensajes?limite=1")
        assert page["siguiente_cursor"]
        call("GET", f"/api/conversaciones/{conversation}/mensajes?limite=1&antes={page['siguiente_cursor']}")
        tasks = [call("POST", f"/api/arriendos/{rental}/tareas", 201, json={"titulo": f"Tarea ficticia {i}", "id_asignado": 3}) for i in range(3)]
        page = call("GET", f"/api/arriendos/{rental}/tareas?limite=1&estado=Pendiente")
        assert page["siguiente_cursor"]
        call("GET", f"/api/arriendos/{rental}/tareas?limite=1&estado=Pendiente&cursor={page['siguiente_cursor']}")
        task = tasks[0]["id_tarea"]
        call("PATCH", f"/api/tareas/{task}", json={"id_asignado": 3})
        call("PATCH", f"/api/tareas/{task}/estado", 403, json={"estado": "Completada"})
        person[0] = 3
        call("PATCH", f"/api/tareas/{task}/estado", json={"estado": "Completada"})
        person[0] = 1
        call("POST", f"/api/arriendos/{rental}/expulsiones", json={"id_usuario": 3, "motivo": "Fin de prueba ficticia", "confirmo": True})
        person[0] = 3
        call("GET", f"/api/arriendos/{rental}/tareas", 403)
        call("GET", f"/api/conversaciones/{conversation}/mensajes", 403)
        target = request.config.getoption("--e06-examples")
        if target:
            destination = Path(target)
            destination.mkdir(parents=True, exist_ok=True)
            (destination / "convivencia-executed.json").write_text(json.dumps({
                "environment": "PostgreSQL efímero; FastAPI real; Auth y puertos entre servicios inyectados; no Expo ni Kubero",
                "examples": examples,
            }, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
            (destination / "convivencia.openapi.json").write_text(json.dumps(app.openapi(), ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
