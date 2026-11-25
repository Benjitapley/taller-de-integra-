"""E04: HTTP real + persistencia PostgreSQL; identidad y Listado inyectados."""
from types import SimpleNamespace
from uuid import uuid4

from fastapi.testclient import TestClient
import pytest

from app.main import create_app, confirmed_actor

pytestmark = pytest.mark.usefixtures("empty_database")


@pytest.fixture
def tasks_http(service, ports):
    ports[1].owner = lambda _: 1
    ports[1].occupancy = lambda _: None
    for user in (2, 3):
        service.incorporate(uuid4(), {"id_usuario": user, "id_publicacion": 7,
                                     "id_postulacion": user + 10, "version_capacidad": 1})
    actor = SimpleNamespace(user_id=2)
    app = create_app(service, run_recovery=False)
    app.dependency_overrides[confirmed_actor] = lambda: actor
    with TestClient(app, raise_server_exceptions=False) as client:
        yield client, actor, service


def test_permissions_invalid_assignee_and_retirement(tasks_http):
    client, actor, service = tasks_http
    url = "/api/arriendos/1/tareas"
    task = client.post(url, json={"titulo": "Aseo", "id_asignado": 3})
    assert task.status_code == 201
    task_id = task.json()["id_tarea"]
    complete = f"/api/tareas/{task_id}/estado"
    assert client.patch(complete, json={"estado": "Completada"}).status_code == 403
    assert client.get(url).json()["items"][0]["estado"] == "Pendiente"
    for assigned in (99, True, -1):
        assert client.post(url, json={"titulo": "Inválida", "id_asignado": assigned}).status_code in (403, 422)
    actor.user_id = 99
    assert client.get(url).status_code == 403
    assert client.patch(complete, json={"estado": "Completada"}).status_code == 403
    actor.user_id = 3
    assert client.patch(complete, json={"estado": "Completada"}).json()["estado"] == "Completada"
    assert client.patch(f"/api/tareas/{task_id}", json={"id_asignado": 2}).status_code == 409
    pending = client.post(url, json={"titulo": "Cocina", "id_asignado": 3}).json()
    service.expel(1, 1, {"id_usuario": 3, "motivo": "Prueba retiro", "confirmo": True})
    assert client.get(url).status_code == 403
    assert client.post(url, json={"titulo": "No autorizada"}).status_code == 403
    assert client.patch(complete, json={"estado": "Completada"}).status_code == 403
    assert client.patch(f"/api/tareas/{pending['id_tarea']}", json={"id_asignado": 2}).status_code == 403
    actor.user_id = 2
    rows = client.get(url).json()["items"]
    assert rows[1]["id_asignado"] is None
    assert rows[0]["estado"] == "Completada"
    path = f"/api/tareas/{pending['id_tarea']}"
    assert client.patch(path, json={"id_asignado": 3}).status_code == 403
    assert client.patch(path, json={"titulo": "Fuera de D04", "id_asignado": 2}).status_code == 422
    assert client.patch(path, json={"id_asignado": 2}).json()["id_asignado"] == 2
    assert client.patch(path + "/estado", json={"estado": "Completada"}).status_code == 200
    assert all(row["estado"] == "Completada" for row in client.get(url).json()["items"])


def test_filtered_pagination_three_pages_and_actor_bound_cursor(tasks_http):
    client, actor, _ = tasks_http
    url = "/api/arriendos/1/tareas"
    for i in range(9):
        task = client.post(url, json={"titulo": f"Tarea {i}", "id_asignado": 2}).json()
        if i % 2:
            assert client.patch(f"/api/tareas/{task['id_tarea']}/estado", json={"estado": "Completada"}).status_code == 200
    cursor = None
    ids = []
    for _ in range(3):
        params = {"estado": "Pendiente", "limite": 2}
        if cursor:
            params["cursor"] = cursor
        response = client.get(url, params=params)
        assert response.status_code == 200
        page = response.json()
        assert all(row["estado"] == "Pendiente" for row in page["items"])
        ids.extend(row["id_tarea"] for row in page["items"])
        cursor = page["siguiente_cursor"]
        if cursor is None:
            break
    assert ids == [1, 3, 5, 7, 9]
    first = client.get(url, params={"limite": 2}).json()
    actor.user_id = 3
    assert client.get(url, params={"cursor": first["siguiente_cursor"]}).status_code == 422
    assert client.get(url, params={"estado": "Inventado"}).status_code == 422
    assert len(client.get(url, params={"estado": "Completada"}).json()["items"]) == 4
    assert client.get(url, params={"id_asignado": 3}).json()["items"] == []
    assert len(client.get(url, params={"estado": "Completada", "id_asignado": 2}).json()["items"]) == 4
    assert client.get(url, params={"id_asignado": -1}).status_code == 422
