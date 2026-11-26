import os
from types import SimpleNamespace
from unittest.mock import Mock
from uuid import UUID, uuid4

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


def test_historial_chat_usa_cursor_anterior_y_oculta_uuid_de_otros(http):
    client, service, application = http
    application.dependency_overrides[confirmed_actor] = lambda: SimpleNamespace(user_id=2, display_name="Integrante dos")
    conversation = {"id_conversacion": 12, "id_arriendo": 4, "fecha_creacion": "2026-11-20T12:00:00Z"}
    own = {"id_mensaje": 23, "id_conversacion": 12, "id_remitente": 2, "nombre_remitente": "Integrante dos",
           "contenido": "Hola", "id_cliente": uuid4(), "fecha_envio": "2026-11-21T12:00:00Z"}
    other = {"id_mensaje": 24, "id_conversacion": 12, "id_remitente": 3, "nombre_remitente": "Integrante tres",
             "contenido": "Buenas", "id_cliente": uuid4(), "fecha_envio": "2026-11-21T12:01:00Z"}
    service.repository.conversation.return_value = conversation
    service.repository.messages.return_value = ([own, other], 23)

    first = client.get("/api/conversaciones/12/mensajes?limite=2")
    assert first.status_code == 200
    assert first.headers["Cache-Control"] == "no-store"
    assert first.json()["items"][0]["id_cliente"] == str(own["id_cliente"])
    assert "id_cliente" not in first.json()["items"][1]
    cursor = first.json()["siguiente_cursor"]

    service.repository.messages.return_value = ([own], None)
    older = client.get("/api/conversaciones/12/mensajes?limite=1&antes=" + cursor)
    assert older.status_code == 200
    assert older.json()["siguiente_cursor"] is None
    assert service.repository.messages.call_args.args == (12, 2, 23, 1)


def test_envio_chat_reusa_uuid_y_mapea_error_de_conflicto(http):
    client, service, application = http
    application.dependency_overrides[confirmed_actor] = lambda: SimpleNamespace(user_id=2, display_name="Integrante dos")
    client_id = uuid4()
    sent = {"id_mensaje": 31, "id_conversacion": 12, "id_remitente": 2, "nombre_remitente": "Integrante dos",
            "contenido": "Mismo contenido", "id_cliente": client_id, "fecha_envio": "2026-11-21T12:00:00Z"}
    service.repository.send_message.return_value = sent
    body = {"contenido": "Mismo contenido", "id_cliente": str(client_id)}

    first = client.post("/api/conversaciones/12/mensajes", json=body)
    replay = client.post("/api/conversaciones/12/mensajes", json=body)
    assert first.status_code == replay.status_code == 200
    assert first.json() == replay.json()
    assert service.repository.send_message.call_args_list[0].args == (12, 2, "Integrante dos", "Mismo contenido", client_id)
    assert service.repository.send_message.call_args_list[1] == service.repository.send_message.call_args_list[0]

    service.repository.send_message.side_effect = ServiceError("MESSAGE_IDEMPOTENCY_CONFLICT", "UUID ya usado.", 409)
    conflict = client.post("/api/conversaciones/12/mensajes", json={**body, "contenido": "Otro contenido"})
    assert conflict.status_code == 409
    assert conflict.headers["Cache-Control"] == "no-store"


@pytest.mark.parametrize("method", ["get", "post"])
@pytest.mark.parametrize("user_id", [2, 99])
def test_http_403_de_convivencia_no_expone_conversacion_por_id_directo(http, method, user_id):
    client, service, application = http
    application.dependency_overrides[confirmed_actor] = lambda: SimpleNamespace(user_id=user_id, display_name="Usuario")
    denied = ServiceError("CONVERSATION_FORBIDDEN", "No tienes acceso.", 403)
    service.repository.conversation.side_effect = denied
    service.repository.send_message.side_effect = denied
    path = "/api/conversaciones/12/mensajes"
    if method == "get":
        result = client.get(path)
    else:
        result = client.post(path, json={"contenido": "No autorizado", "id_cliente": str(uuid4())})
    assert result.status_code == 403
    assert result.headers["Cache-Control"] == "no-store"
    assert result.json()["codigo"] == "sin_permiso"
    if method == "post":
        service.repository.send_message.assert_called_once()


def test_expulsion_deriva_actor_y_no_exige_clave_del_mensaje(http):
    client, service, application = http
    application.dependency_overrides[confirmed_actor] = lambda: SimpleNamespace(user_id=1)
    service.expel.return_value = {"id_usuario": 3, "estado": "Inactiva"}
    response = client.post("/api/arriendos/4/expulsiones", json={"id_usuario": 3, "motivo": "Retiro de prueba", "confirmacion": True})
    assert response.status_code == 200
    service.expel.assert_called_once_with(4, 1, 3, "Retiro de prueba")


@pytest.mark.parametrize("changes", [{"confirmacion": False}, {"confirmacion": "true"}, {"motivo": " "}, {"motivo": "x" * 501}, {"id_usuario": True}, {"id_actor": 1}])
def test_expulsion_rechaza_payload_no_confirmado_o_actor_inyectado(http, changes):
    client, service, application = http
    application.dependency_overrides[confirmed_actor] = lambda: SimpleNamespace(user_id=1)
    response = client.post("/api/arriendos/4/expulsiones", json={"id_usuario": 3, "motivo": "Prueba", "confirmacion": True, **changes})
    assert response.status_code == 422
    service.expel.assert_not_called()
