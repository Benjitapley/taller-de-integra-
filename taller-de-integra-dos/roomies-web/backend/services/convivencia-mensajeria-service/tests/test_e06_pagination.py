"""E06: contrato HTTP y SQL reales en PostgreSQL efímero; no acredita Expo físico."""
from types import SimpleNamespace
from uuid import uuid4

from fastapi.testclient import TestClient
import psycopg
import pytest

from app.main import create_app, confirmed_actor, access_token
from app.models import ServiceError

pytestmark = pytest.mark.usefixtures("empty_database")


def test_members_three_pages_ties_context_end_and_revocation(service, ports, migrated_database):
    ports[1].capacity = 60
    ports[1].owned_by = lambda publication, actor, token: actor == 1
    for user in range(2, 55):
        service.incorporate(uuid4(), {"id_usuario": user, "id_publicacion": 7, "id_postulacion": user, "version_capacidad": 1})
    rental = service.repository.mine(2)["id_arriendo"]
    with psycopg.connect(migrated_database) as connection:
        # Fechas empatadas y orden diferente al identity prueban la clave compuesta.
        connection.execute("UPDATE convivencia_mensajeria.pertenencia SET creada_en='2026-11-26T12:00:00Z'::timestamptz - (id_usuario % 3)*interval '1 day'")
        expected = [row[0] for row in connection.execute("SELECT id_usuario FROM convivencia_mensajeria.pertenencia ORDER BY creada_en,id_pertenencia")]
    app = create_app(service, run_recovery=False)
    person = [2]
    app.dependency_overrides[confirmed_actor] = lambda: SimpleNamespace(user_id=person[0])
    app.dependency_overrides[access_token] = lambda: "isolated"
    with TestClient(app) as client:
        path = f"/api/arriendos/{rental}/integrantes"
        cursor, ids, pages, first = None, [], 0, None
        while True:
            response = client.get(path, params={"limite": 20, **({"cursor": cursor} if cursor else {})})
            assert response.status_code == 200, response.text
            page = response.json()
            ids.extend(row["id_usuario"] for row in page["items"])
            cursor = page["siguiente_cursor"]
            first = first or cursor
            pages += 1
            if cursor is None:
                break
        assert pages == 3 and ids == expected and len(set(ids)) == 53
        assert client.get(path, params={"cursor": "bad"}).status_code == 422
        assert client.get(path, params={"limite": 10, "cursor": first}).status_code == 422
        person[0] = 3
        assert client.get(path, params={"cursor": first}).status_code == 422
        person[0] = 2
        with psycopg.connect(migrated_database) as connection:
            connection.execute("UPDATE convivencia_mensajeria.pertenencia SET estado='Inactiva' WHERE id_usuario=2")
        assert client.get(path, params={"cursor": first}).status_code == 403
        assert client.get("/api/conversaciones").json() == {"items": [], "siguiente_cursor": None}


def test_tasks_date_id_three_pages_and_invalid_anchor(service, ports, migrated_database):
    service.incorporate(uuid4(), {"id_usuario": 2, "id_publicacion": 7, "id_postulacion": 2, "version_capacidad": 1})
    rental = service.repository.mine(2)["id_arriendo"]
    for i in range(53):
        service.repository.create_task(rental, 2, f"E06 {i}", None, 2)
    with psycopg.connect(migrated_database) as connection:
        connection.execute("UPDATE convivencia_mensajeria.tarea SET fecha_creacion='2026-11-26T12:00:00Z'::timestamptz - (id_tarea % 3)*interval '1 day'")
        expected = [row[0] for row in connection.execute("SELECT id_tarea FROM convivencia_mensajeria.tarea ORDER BY fecha_creacion DESC,id_tarea DESC")]
    cursor, ids, pages = None, [], 0
    while True:
        rows, cursor = service.repository.list_tasks(rental, 2, "Pendiente", cursor, 20)
        ids.extend(row["id_tarea"] for row in rows)
        pages += 1
        if cursor is None:
            break
    assert pages == 3 and ids == expected and len(set(ids)) == 53
    with pytest.raises(ServiceError) as failure:
        service.repository.list_tasks(rental, 2, "Pendiente", 9223372036854775807, 20)
    assert failure.value.status == 422


def test_conversations_contract_is_bounded_by_active_membership(service):
    service.incorporate(uuid4(), {"id_usuario": 2, "id_publicacion": 7, "id_postulacion": 2, "version_capacidad": 1})
    app = create_app(service, run_recovery=False)
    app.dependency_overrides[confirmed_actor] = lambda: SimpleNamespace(user_id=2)
    with TestClient(app) as client:
        response = client.get("/api/conversaciones", params={"limite": 1})
        assert response.status_code == 200
        assert len(response.json()["items"]) == 1
        assert response.json()["siguiente_cursor"] is None  # D02: un solo arriendo activo.
        for params in ({"cursor": "bad"}, {"limite": 0}, {"limite": 101}):
            assert client.get("/api/conversaciones", params=params).status_code == 422


def test_member_cursor_query_bounds_without_repository_access():
    from unittest.mock import Mock
    service = Mock()
    app = create_app(service, run_recovery=False)
    app.dependency_overrides[confirmed_actor] = lambda: SimpleNamespace(user_id=2)
    app.dependency_overrides[access_token] = lambda: "isolated"
    with TestClient(app) as client:
        for cursor in ("", "x" * 2049):
            assert client.get("/api/arriendos/1/integrantes", params={"cursor": cursor}).status_code == 422
    service.repository.members.assert_not_called()


def test_conversation_cursor_signature_account_and_limit():
    # Contrato aislado con repositorio inyectado; no acredita volumen real D02.
    from unittest.mock import Mock
    service = Mock()
    rows = [{"id_conversacion": n, "id_arriendo": n, "fecha_creacion": "2026-11-26T12:00:00Z"} for n in (1, 2)]
    service.repository.conversations.return_value = rows
    app = create_app(service, run_recovery=False)
    actor = [2]
    app.dependency_overrides[confirmed_actor] = lambda: SimpleNamespace(user_id=actor[0])
    with TestClient(app) as client:
        cursor = client.get("/api/conversaciones?limite=1").json()["siguiente_cursor"]
        assert cursor
        actor[0] = 3
        assert client.get("/api/conversaciones", params={"limite": 1, "cursor": cursor}).status_code == 422
        actor[0] = 2
        assert client.get("/api/conversaciones", params={"limite": 2, "cursor": cursor}).status_code == 422
        assert client.get("/api/conversaciones", params={"limite": 1, "cursor": cursor + "x"}).status_code == 422
        service.repository.conversations.return_value = rows[1:]
        page = client.get("/api/conversaciones", params={"limite": 1, "cursor": cursor})
        assert page.status_code == 200 and page.json()["siguiente_cursor"] is None
        service.repository.conversations.assert_called_with(2, 1, 1)
