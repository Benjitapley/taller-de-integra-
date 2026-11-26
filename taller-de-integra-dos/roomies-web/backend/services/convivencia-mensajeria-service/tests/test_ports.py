from uuid import UUID

import httpx
import pytest

from app.models import ServiceError
from app.ports import HttpIdentity, HttpPublications

KEY = UUID("c9c989c1-7f6a-48c0-8bab-000000000001")
PAYLOAD = {"id_usuario": 2, "id_publicacion": 7, "id_postulacion": 9, "version_capacidad": 1}
RESERVATION = {**PAYLOAD, "id_reserva": "c9c989c1-7f6a-48c0-8bab-000000000002", "cupos_totales": 2}
CONFIRMATION = {"id_arriendo": 1, "ocupacion": 1, "version_ocupacion": 1}


@pytest.fixture
def transport(monkeypatch):
    monkeypatch.setenv("AUTH_USERS_UPSTREAM_URL", "http://127.0.0.1:8001")
    monkeypatch.setenv("LISTADO_UPSTREAM_URL", "http://127.0.0.1:8002")
    original = httpx.Client

    def setup(handler):
        monkeypatch.setattr(httpx, "Client", lambda **kw: original(transport=httpx.MockTransport(handler), **kw))
    return setup


def test_reserva_envia_clave_y_payload_congelados(transport):
    import json
    requests = []

    def handler(request):
        requests.append(request)
        return httpx.Response(201, json=RESERVATION)

    transport(handler)
    result = HttpPublications().reserve(KEY, PAYLOAD)
    assert result == RESERVATION
    sent = requests[0]
    assert sent.url.path == "/internal/publicaciones/7/reservas"
    assert sent.headers["Idempotency-Key"] == str(KEY)
    assert len(sent.headers["X-Roomies-Service"]) >= 32
    assert json.loads(sent.content) == {**PAYLOAD, "id_operacion": str(KEY)}


@pytest.mark.parametrize("body", [
    {**RESERVATION, "id_usuario": 99}, {**RESERVATION, "version_capacidad": 2},
    {**RESERVATION, "cupos_totales": 0}, {**RESERVATION, "otro": "no"},
])
def test_reserva_respuesta_invalida_no_se_admite(transport, body):
    transport(lambda request: httpx.Response(201, json=body))
    with pytest.raises(ServiceError) as error:
        HttpPublications().reserve(KEY, PAYLOAD)
    assert error.value.status == 503


@pytest.mark.parametrize("status", [404, 500, 302])
def test_proveedor_ausente_o_fallando_no_inventa_reserva(transport, status):
    transport(lambda request: httpx.Response(status, text="private provider detail"))
    with pytest.raises(ServiceError) as error:
        HttpPublications().reserve(KEY, PAYLOAD)
    assert error.value.status == 503
    assert "private" not in error.value.body["detail"]


def test_ultimo_cupo_error_proveedor_sanitizado(transport):
    transport(lambda request: httpx.Response(409, json={"code": "NO_CAPACITY", "detail": "private detail"}))
    with pytest.raises(ServiceError) as error:
        HttpPublications().reserve(KEY, PAYLOAD)
    assert error.value.status == 409
    assert error.value.body["code"] == "NO_CAPACITY"
    assert "private" not in error.value.body["detail"]


def test_confirmar_liberar_reusan_misma_identidad_reserva(transport):
    import json
    calls = []

    def handler(request):
        calls.append((request.method, request.url.path, request.headers["Idempotency-Key"], json.loads(request.content) if request.content else None))
        return httpx.Response(204)

    transport(handler)
    port = HttpPublications()
    port.confirm(KEY, {**RESERVATION, "confirmacion": CONFIRMATION})
    port.release(KEY, RESERVATION)
    prefix = "/internal/publicaciones/7/reservas/" + RESERVATION["id_reserva"]
    assert calls == [("PUT", prefix + "/confirmacion", str(KEY), CONFIRMATION), ("DELETE", prefix, str(KEY), None)]


def test_confirmacion_sin_proyeccion_no_inventa_cupos(transport):
    calls = []
    transport(lambda request: calls.append(request) or httpx.Response(204))
    with pytest.raises(ServiceError) as error:
        HttpPublications().confirm(KEY, RESERVATION)
    assert error.value.status == 503 and not calls


@pytest.mark.parametrize("body", [
    {"id_usuario": 2, "habilitado": "true"}, {"id_usuario": 3, "habilitado": True},
    {"id_usuario": 2}, {"id_usuario": 2, "habilitado": True, "extra": 0},
])
def test_identidad_estricta(transport, body):
    transport(lambda request: httpx.Response(200, json=body))
    with pytest.raises(ServiceError) as error:
        HttpIdentity().enabled(2)
    assert error.value.status == 503


def test_identidad_habilitada_y_deshabilitada(transport):
    for enabled in [True, False]:
        transport(lambda request: httpx.Response(200, json={"id_usuario": 2, "habilitado": enabled}))
        assert HttpIdentity().enabled(2) is enabled


@pytest.mark.parametrize("owner", [True,0,"1",None])
def test_propietario_invalido_falla_cerrado(transport, owner):
    transport(lambda request:httpx.Response(200,json={"id_propietario":owner}))
    with pytest.raises(ServiceError) as error:
        HttpPublications().owner(7)
    assert error.value.status == 503


def test_propietario_y_ocupacion_usan_api_interna(transport):
    calls=[]
    def handler(request):
        calls.append(request)
        return httpx.Response(200,json={"id_propietario":1})
    transport(handler)
    port=HttpPublications()
    assert port.owner(7) == 1
    port.occupancy({"id_publicacion":7,"ocupacion":0,"version_ocupacion":3,"finalizado":True})
    import json
    assert calls[0].url.path == "/internal/publicaciones/7/propietario"
    assert calls[1].method == "PUT"
    assert json.loads(calls[1].content) == {"ocupacion":0,"version_ocupacion":3,"finalizado":True}


@pytest.mark.parametrize("actor,expected", [(1, True), (2, False)])
def test_acceso_del_dueno_no_depende_del_dto_publico(transport, actor, expected):
    calls = []

    def handler(request):
        calls.append(request)
        # El detalle público canónico ya no expone id_propietario.
        if request.url.path == "/api/publicaciones/7":
            return httpx.Response(200, json={"id_publicacion": 7})
        assert request.url.path == "/internal/publicaciones/7/propietario"
        assert "X-Roomies-Service" in request.headers
        assert "Authorization" not in request.headers
        return httpx.Response(200, json={"id_propietario": 1})

    transport(handler)
    assert HttpPublications().owned_by(7, actor, "user-token") is expected
    assert len(calls) == 1
