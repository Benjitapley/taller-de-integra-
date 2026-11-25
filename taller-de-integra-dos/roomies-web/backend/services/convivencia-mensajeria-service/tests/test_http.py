import os
from types import SimpleNamespace
from unittest.mock import Mock
from uuid import UUID

from fastapi.testclient import TestClient
import pytest

from app.main import create_app, confirmed_actor
from app.models import ServiceError

KEY = "c9c989c1-7f6a-48c0-8bab-000000000001"
PAYLOAD = {"id_usuario": 2, "id_publicacion": 7, "id_postulacion": 9, "version_capacidad": 1}
BODY = {"id_incorporacion": KEY, "id_arriendo": 1, "id_publicacion": 7,
        "id_usuario": 2, "estado": "Activa", "confirmacion_publicacion": "Pendiente"}


@pytest.fixture
def http():
    service = Mock()
    service.incorporate.return_value = (201, BODY, False)
    application = create_app(service, run_recovery=False)
    with TestClient(application, raise_server_exceptions=False) as client:
        yield client, service, application


def headers():
    return {"X-Roomies-Service": os.environ["ROOMIES_INTERNAL_TOKEN"], "Idempotency-Key": KEY}


def test_post_contrato_y_replay(http):
    client, service, _ = http
    result = client.post("/internal/incorporaciones", headers=headers(), json=PAYLOAD)
    assert result.status_code == 201
    assert result.json() == BODY
    assert result.headers["Cache-Control"] == "no-store"
    assert result.headers["Idempotency-Replayed"] == "false"
    service.incorporate.assert_called_once_with(UUID(KEY), PAYLOAD)
    service.incorporate.return_value = (201, BODY, True)
    retry = client.post("/internal/incorporaciones", headers=headers(), json=PAYLOAD)
    assert retry.json() == result.json()
    assert retry.headers["Idempotency-Replayed"] == "true"


@pytest.mark.parametrize("changes", [
    {"id_usuario": True}, {"id_usuario": "2"}, {"id_publicacion": 0},
    {"id_postulacion": -1}, {"version_capacidad": 0}, {"extra": "no"},
    {"id_usuario": 9223372036854775808},
])
def test_payload_estricto_no_llega_a_negocio(http, changes):
    client, service, _ = http
    result = client.post("/internal/incorporaciones", headers=headers(), json={**PAYLOAD, **changes})
    assert result.status_code == 422
    assert result.json()["code"] == "INVALID_REQUEST"
    service.incorporate.assert_not_called()


@pytest.mark.parametrize("key", [None, "invalid"])
def test_clave_obligatoria_uuid(http, key):
    client, service, _ = http
    values = headers()
    if key is None:
        values.pop("Idempotency-Key")
    else:
        values["Idempotency-Key"] = key
    result = client.post("/internal/incorporaciones", headers=values, json=PAYLOAD)
    assert result.status_code == 422
    service.incorporate.assert_not_called()


@pytest.mark.parametrize("token", [None, "wrong-service-token"])
def test_incorporacion_requiere_credencial_interna(http, token):
    client, service, _ = http
    values = {"Idempotency-Key": KEY}
    if token:
        values["X-Roomies-Service"] = token
    result = client.post("/internal/incorporaciones", headers=values, json=PAYLOAD)
    assert result.status_code == 403
    assert result.json()["code"] == "FORBIDDEN"
    service.incorporate.assert_not_called()


def test_configuracion_interna_ausente_falla_cerrado(http, monkeypatch):
    client, service, _ = http
    values = headers()
    monkeypatch.delenv("ROOMIES_INTERNAL_TOKEN")
    result = client.post("/internal/incorporaciones", headers=values, json=PAYLOAD)
    assert result.status_code == 503
    service.incorporate.assert_not_called()


def test_get_requiere_sesion(http):
    client, _, _ = http
    for path in ["/api/arriendos/mio", "/api/arriendos/1"]:
        result = client.get(path)
        assert result.status_code == 401
        assert result.json()["code"] == "UNAUTHENTICATED"


def test_get_pasa_usuario_autenticado_y_oculta_arriendo_ajeno(http):
    client, service, application = http
    application.dependency_overrides[confirmed_actor] = lambda: SimpleNamespace(user_id=2)
    rental = {"id_arriendo": 1, "id_publicacion": 7, "cupos_totales": 2, "version_capacidad": 1, "ocupacion": 1}
    service.repository.mine.return_value = rental
    service.repository.get.return_value = rental
    assert client.get("/api/arriendos/mio").json() == rental
    result = client.get("/api/arriendos/1")
    assert result.status_code == 200
    assert result.json() == rental
    service.repository.mine.assert_called_once_with(2)
    service.repository.get.assert_called_once_with(1, 2)
    service.repository.get.side_effect = ServiceError("RENTAL_NOT_FOUND", "Arriendo no encontrado.", 404)
    assert client.get("/api/arriendos/999").status_code == 404


@pytest.mark.parametrize("status,code", [(409, "USER_ALREADY_ACTIVE"), (503, "DEPENDENCY_UNAVAILABLE")])
def test_errores_estables_no_exponen_excepciones(http, status, code):
    client, service, _ = http
    service.incorporate.side_effect = ServiceError(code, "Mensaje sanitizado.", status)
    result = client.post("/internal/incorporaciones", headers=headers(), json=PAYLOAD)
    assert result.status_code == status
    assert result.json() == {"detail": "Mensaje sanitizado.", "code": code}
    assert result.headers["Cache-Control"] == "no-store"


def test_error_inesperado_sanitizado(http):
    client, service, _ = http
    service.incorporate.side_effect = RuntimeError("secret-dsn-that-must-not-leak")
    result = client.post("/internal/incorporaciones", headers=headers(), json=PAYLOAD)
    assert result.status_code == 503
    assert "secret-dsn" not in result.text


def test_openapi_tres_rutas_y_modelos(http):
    client, _, _ = http
    schema = client.get("/openapi.json").json()
    assert {"/internal/incorporaciones", "/api/arriendos/mio", "/api/arriendos/{id}"} <= schema["paths"].keys()
    body = schema["components"]["schemas"]["Incorporation"]
    assert body["additionalProperties"] is False
    assert set(body["required"]) == set(PAYLOAD)


def test_members_pages_are_bound_to_actor_and_rental(http):
    from app.main import access_token
    client, service, application = http
    application.dependency_overrides[confirmed_actor] = lambda: SimpleNamespace(user_id=2)
    application.dependency_overrides[access_token] = lambda: "fixture"
    service.repository.rental_publication.return_value = 7
    rows = [{"id_pertenencia": i, "id_usuario": i, "fecha_ingreso": "2026-11-20T12:00:00Z", "activo": True, "es_responsable": i == 1} for i in range(1, 4)]
    service.repository.members.return_value = rows
    result = client.get("/api/arriendos/1/integrantes?limite=2")
    assert result.status_code == 200
    assert len(result.json()["items"]) == 2
    cursor = result.json()["siguiente_cursor"]
    assert cursor
    assert client.get("/api/arriendos/2/integrantes", params={"cursor": cursor, "limite": 2}).status_code == 422
    application.dependency_overrides[confirmed_actor] = lambda: SimpleNamespace(user_id=3)
    assert client.get("/api/arriendos/1/integrantes", params={"cursor": cursor, "limite": 2}).status_code == 422
    assert client.get("/api/arriendos/1/integrantes?cursor=bad").status_code == 422


def test_nonresident_owner_can_read_but_admin_cannot(http):
    from app.main import access_token
    client, service, application = http
    application.dependency_overrides[confirmed_actor] = lambda: SimpleNamespace(user_id=2, administrator=True)
    application.dependency_overrides[access_token] = lambda: "fixture"
    service.repository.rental_publication.return_value = 7
    service.repository.get.side_effect = ServiceError("NOT_FOUND", "No pertenece", 404)
    service.publications.owned_by.return_value = False
    service.repository.members.side_effect = ServiceError("FORBIDDEN", "Sin acceso", 403)
    assert client.get("/api/arriendos/1/integrantes").status_code == 403
    service.repository.members.assert_called_with(1, 2, False, 0, 20)
    service.publications.owned_by.return_value = True
    service.repository.members.side_effect = None
    service.repository.members.return_value = []
    assert client.get("/api/arriendos/1/integrantes").json() == {"items": [], "siguiente_cursor": None}
    service.repository.members.assert_called_with(1, 2, True, 0, 20)
