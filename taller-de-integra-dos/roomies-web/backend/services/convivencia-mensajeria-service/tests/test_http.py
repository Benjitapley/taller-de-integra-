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


def test_integrantes_y_retiro_pasan_usuario_autenticado(http):
    client, service, application = http
    application.dependency_overrides[confirmed_actor] = lambda: SimpleNamespace(user_id=2)
    service.members.return_value = {
        "items": [{"id_usuario": 2, "fecha_ingreso": "2026-11-20T00:00:00Z", "fecha_salida": None, "es_responsable": True}],
        "siguiente_cursor": None,
    }
    service.expel.return_value = {"id_arriendo": 1, "id_usuario": 3, "retirado": True}

    result = client.get("/api/arriendos/1/integrantes?activos=true")
    assert result.status_code == 200
    assert result.json()["items"][0]["id_usuario"] == 2
    service.members.assert_called_once_with(1, 2, True)

    result = client.post("/api/arriendos/1/expulsiones", json={"id_usuario": 3, "motivo": "Incumplimiento de reglas", "confirmo": True})
    assert result.status_code == 200
    assert result.json()["retirado"] is True
    service.expel.assert_called_once_with(1, 2, {"id_usuario": 3, "motivo": "Incumplimiento de reglas", "confirmo": True})


@pytest.mark.parametrize("body", [
    {},
    {"id_usuario": 3, "motivo": "", "confirmo": True},
    {"id_usuario": 3, "motivo": "Motivo válido", "confirmo": False},
    {"id_usuario": 0, "motivo": "Motivo válido", "confirmo": True},
    {"id_usuario": 3, "motivo": "x" * 501, "confirmo": True},
])
def test_retiro_payload_estricto(http, body):
    client, service, application = http
    application.dependency_overrides[confirmed_actor] = lambda: SimpleNamespace(user_id=2)
    result = client.post("/api/arriendos/1/expulsiones", json=body)
    assert result.status_code == 422
    service.expel.assert_not_called()


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
    assert {"/internal/incorporaciones", "/api/arriendos/mio", "/api/arriendos/{id}",
            "/api/arriendos/{id}/integrantes", "/api/arriendos/{id}/expulsiones"} <= schema["paths"].keys()
    body = schema["components"]["schemas"]["Incorporation"]
    assert body["additionalProperties"] is False
    assert set(body["required"]) == set(PAYLOAD)
