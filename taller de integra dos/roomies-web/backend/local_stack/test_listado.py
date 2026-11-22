from unittest.mock import Mock
import pytest
from app.domain.publications import available, transition, validate_publication
from app.application.service import Publications
from backend.service_runtime.contracts import RuleViolation, DependencyUnavailable

PUB = {"id_publicacion": 7, "id_usuario": 1, "estado": "Disponible", "tipo": "Arrendador", "cupos_totales": 2}
APP = {"id_postulacion": 9, "id_publicacion": 7, "id_usuario": 2, "estado": "Pendiente"}
DATA = {"titulo": "Habitación", "descripcion": "Prueba", "ubicacion": "Temuco", "precio": "250000.50", "cupos_totales": "2", "tipo": "Arrendador", "categoria": "ofrezco", "tipo_vivienda": "habitacion", "mascota": "no"}

def test_cupos_no_inventa_ocupacion():
    occupancy = Mock()
    assert available(PUB, occupancy) == 2
    assert available({**PUB, "estado": "Cerrada"}, occupancy) == 0
    occupancy.active_members.assert_not_called()
    occupancy.active_members.return_value = 1
    assert available({**PUB, "estado": "Activa"}, occupancy) == 1
    occupancy.active_members.side_effect = DependencyUnavailable()
    with pytest.raises(DependencyUnavailable): available({**PUB, "estado": "Activa"}, occupancy)

@pytest.mark.parametrize("key,value", [("precio", "NaN"), ("precio", "1.001"), ("precio", "-1"), ("cupos_totales", "0"), ("cupos_totales", "2.5"), ("titulo", " "), ("mascota", "quizas"), ("tipo", "Otro")])
def test_rechaza_publicacion_invalida(key, value):
    with pytest.raises(RuleViolation): validate_publication({**DATA, key: value})

@pytest.mark.parametrize("actor,target", [(2, "Aceptada"), (3, "Rechazada"), (1, "Cancelada"), (3, "Cancelada")])
def test_decisiones_segun_pertenencia(actor, target):
    with pytest.raises(RuleViolation) as error: transition(APP, PUB, actor, target, "Motivo")
    assert error.value.status == 403

def test_transiciones_finales_y_motivos():
    assert transition(APP, PUB, 1, "Preseleccionada", None)
    with pytest.raises(RuleViolation): transition(APP, PUB, 1, "Aceptada", None)
    assert transition({**APP, "estado": "Preseleccionada"}, PUB, 1, "Aceptada", None)
    with pytest.raises(RuleViolation): transition(APP, PUB, 2, "Cancelada", " ")
    assert transition(APP, PUB, 2, "Cancelada", "Otra alternativa")
    with pytest.raises(RuleViolation): transition({**APP, "estado": "Aceptada"}, PUB, 2, "Cancelada", "Salida")
    assert not transition({**APP, "estado": "Aceptada"}, PUB, 1, "Aceptada", None)

def test_cerrada_no_preselecciona_pero_conserva_rechazo():
    with pytest.raises(RuleViolation): transition(APP, {**PUB, "estado": "Cerrada"}, 1, "Preseleccionada", None)
    assert transition(APP, {**PUB, "estado": "Cerrada"}, 1, "Rechazada", "Cierre")

def test_no_guardar_imagen_ni_editar_otra_publicacion():
    repo, images = Mock(), Mock()
    repo.transaction.return_value.__enter__ = Mock()
    repo.transaction.return_value.__exit__ = Mock(return_value=False)
    repo.publication.return_value = PUB
    service = Publications(repo, Mock(), images)
    with pytest.raises(RuleViolation): service.save(2, DATA, b"image", 7)
    repo.update.assert_not_called()
    images.save.assert_not_called()

def test_outbox_es_idempotente_y_reintenta_caida():
    from app.application.notifications import dispatch
    repo, notification = Mock(), Mock()
    repo.pending_events.return_value = [{"event_key": "postulacion:9:Aceptada"}]
    notification.send.side_effect = RuntimeError("Offline")
    assert dispatch(repo, notification) == 0
    repo.delivered.assert_not_called()
    notification.send.side_effect = None
    assert dispatch(repo, notification) == 1
    repo.delivered.assert_called_once_with("postulacion:9:Aceptada")

def test_arrendador_ofrece_espacio_y_no_busca_arriendo():
    repo, images = Mock(), Mock()
    with pytest.raises(RuleViolation): Publications(repo, Mock(), images).save(1, {**DATA, "categoria":"busco"})
    repo.transaction.assert_not_called()
    images.save.assert_not_called()


def test_publicacion_guarda_hasta_cinco_imagenes_ordenadas():
    from unittest.mock import call
    repo, images = Mock(), Mock()
    repo.create.return_value = 7
    repo.transaction.return_value.__enter__ = Mock()
    repo.transaction.return_value.__exit__ = Mock(return_value=False)
    images.save.side_effect = ["/imagenes/p_a.jpg", "/imagenes/p_b.jpg"]
    result = Publications(repo, Mock(), images).save(1, {**DATA, "precio": "250000"}, images=[b"a", b"b"])
    assert result == 7
    assert repo.image.call_args_list == [call(7, "/imagenes/p_a.jpg", 0), call(7, "/imagenes/p_b.jpg", 1)]


def test_edicion_conserva_agrega_y_quita_imagenes_solo_al_guardar():
    from unittest.mock import call
    repo, images = Mock(), Mock()
    repo.transaction.return_value.__enter__ = Mock()
    repo.transaction.return_value.__exit__ = Mock(return_value=False)
    repo.publication.return_value = {**PUB, "estado": "Disponible"}
    repo.images.return_value = [
        {"id_imagen": 11, "url": "/imagenes/old-a.jpg", "orden": 0},
        {"id_imagen": 12, "url": "/imagenes/old-b.jpg", "orden": 1},
    ]
    images.save.return_value = "/imagenes/new-c.jpg"
    result = Publications(repo, Mock(), images).save(
        1, {**DATA, "precio": "250000"}, images=[b"new"], id=7, keep_image_ids=[12])
    assert result == 7
    repo.order_image.assert_called_once_with(7, 12, 0)
    repo.remove_image.assert_called_once_with(7, 11)
    repo.image.assert_called_once_with(7, "/imagenes/new-c.jpg", 1)
    images.delete.assert_called_once_with("/imagenes/old-a.jpg")


def test_edicion_rechaza_ids_de_imagen_ajenos_y_capacidad_en_conflicto():
    repo, images = Mock(), Mock()
    repo.transaction.return_value.__enter__ = Mock()
    repo.transaction.return_value.__exit__ = Mock(return_value=False)
    repo.publication.return_value = {**PUB, "estado": "Disponible"}
    repo.images.return_value = [{"id_imagen": 11, "url": "/imagenes/old.jpg", "orden": 0}]
    service = Publications(repo, Mock(), images)
    with pytest.raises(RuleViolation) as error:
        service.save(1, {**DATA, "precio": "250000"}, id=7, keep_image_ids=[99])
    assert error.value.status == 409
    images.save.assert_not_called()

    repo.publication.return_value = {**PUB, "estado": "Activa", "cupos_totales": 3}
    with pytest.raises(RuleViolation) as error:
        service.save(1, {**DATA, "precio": "250000", "cupos_totales": "2"}, id=7, keep_image_ids=[11])
    assert error.value.status == 409
    repo.update.assert_not_called()


@pytest.fixture
def incorporation_client(monkeypatch):
    import httpx
    from app.infrastructure.clients import HttpIncorporations
    monkeypatch.setenv("ROOMIES_LOCAL_MODE", "1")
    monkeypatch.setenv("ROOMIES_RUNTIME_MODE", "disposable")
    monkeypatch.setenv("ROOMIES_INTERNAL_TOKEN", "synthetic-service-token-for-local-tests")
    monkeypatch.setenv("CONVIVENCIA_UPSTREAM_URL", "http://127.0.0.1:8004")
    requests = []
    response = {"status": 201, "replayed": "false", "body": {"id_incorporacion": "08864c0e-fb98-451a-bfd3-b92ed5e13b54", "id_arriendo": 4,
                "id_publicacion": 7, "id_usuario": 2, "estado": "Activa", "confirmacion_publicacion": "Pendiente"}}
    def handler(request):
        requests.append(request)
        if "failure" in response: raise httpx.ConnectError(response["failure"], request=request)
        return httpx.Response(response["status"], json=response["body"], headers={"Idempotency-Replayed": response["replayed"]})
    original = httpx.Client
    def client(**options):
        assert options == {"timeout": 5, "trust_env": False, "follow_redirects": False}
        return original(**options, transport=httpx.MockTransport(handler))
    monkeypatch.setattr(httpx, "Client", client)
    return HttpIncorporations(), requests, response


INCORPORATION = {"id_postulacion": 9, "id_publicacion": 7, "id_usuario": 2, "version_capacidad": 1}
RETRY_KEY = "08864c0e-fb98-451a-bfd3-b92ed5e13b54"


def test_incorporacion_congela_payload_y_repite_misma_clave(incorporation_client):
    import json
    client, requests, response = incorporation_client
    assert client.incorporate(INCORPORATION, RETRY_KEY) == response["body"]
    response["replayed"] = "true"
    assert client.incorporate(INCORPORATION, RETRY_KEY) == response["body"]
    assert len(requests) == 2
    for request in requests:
        assert str(request.url) == "http://127.0.0.1:8004/internal/incorporaciones"
        assert request.method == "POST"
        assert json.loads(request.content) == INCORPORATION
        assert request.headers["idempotency-key"] == RETRY_KEY
        assert request.headers["x-roomies-service"] == "synthetic-service-token-for-local-tests"
        assert "authorization" not in request.headers


@pytest.mark.parametrize("code", ["USER_ALREADY_ACTIVE", "IDEMPOTENCY_CONFLICT", "CAPACITY_VERSION_CONFLICT", "NO_CAPACITY", "APPLICATION_ALREADY_PROCESSED", "APPLICATION_NOT_ACCEPTED", "PUBLICATION_CLOSED"])
def test_incorporacion_preserva_codigo_sin_filtrar_detalle_del_upstream(incorporation_client, code):
    from app.infrastructure.clients import IncorporationRejected
    client, requests, response = incorporation_client
    response.update(status=409, body={"code": code, "detail": "password=synthetic-internal-secret"})
    with pytest.raises(IncorporationRejected) as error: client.incorporate(INCORPORATION, RETRY_KEY)
    assert error.value.status == 409 and error.value.code == code
    assert "synthetic-internal-secret" not in str(error.value)
    assert len(requests) == 1


@pytest.mark.parametrize("changes", [{"id_usuario": True}, {"id_usuario": 0}, {"version_capacidad": -1}, {"extra": 1}])
def test_incorporacion_rechaza_payload_invalido_sin_red(incorporation_client, changes):
    from app.infrastructure.clients import IncorporationRejected
    client, requests, _ = incorporation_client
    with pytest.raises(IncorporationRejected) as error: client.incorporate({**INCORPORATION, **changes}, RETRY_KEY)
    assert error.value.status == 422
    assert not requests


def test_incorporacion_rechaza_clave_no_uuid_y_falta_de_secreto(incorporation_client, monkeypatch):
    from app.infrastructure.clients import IncorporationRejected
    client, requests, _ = incorporation_client
    with pytest.raises(IncorporationRejected): client.incorporate(INCORPORATION, "not-a-uuid")
    monkeypatch.delenv("ROOMIES_INTERNAL_TOKEN")
    with pytest.raises(DependencyUnavailable): client.incorporate(INCORPORATION, RETRY_KEY)
    assert not requests


@pytest.mark.parametrize("status,body", [(503, {"code": "DEPENDENCY_UNAVAILABLE", "detail": "private"}), (302, {}), (409, {"code": "unknown", "detail": "private"}), (201, {"id_arriendo": 4})])
def test_incorporacion_no_infiere_exito_ni_reintenta_automaticamente(incorporation_client, status, body):
    client, requests, response = incorporation_client
    response.update(status=status, body=body)
    with pytest.raises(DependencyUnavailable) as error: client.incorporate(INCORPORATION, RETRY_KEY)
    assert "private" not in str(error.value)
    assert len(requests) == 1


def test_incorporacion_caida_y_usuario_de_respuesta_inconsistente(incorporation_client):
    client, requests, response = incorporation_client
    response["body"]["id_usuario"] = 99
    with pytest.raises(DependencyUnavailable): client.incorporate(INCORPORATION, RETRY_KEY)
    response["failure"] = "password=synthetic-internal-secret"
    with pytest.raises(DependencyUnavailable) as error: client.incorporate(INCORPORATION, RETRY_KEY)
    assert "synthetic-internal-secret" not in str(error.value)
    assert len(requests) == 2


@pytest.mark.parametrize("field,value", [("id_incorporacion", "8af3059b-21ce-40fc-bded-dc1ec486f3e8"), ("id_arriendo", True), ("estado", "Otra")])
def test_incorporacion_rechaza_confirmacion_inconsistente(incorporation_client, field, value):
    client, _, response = incorporation_client
    response["body"][field] = value
    with pytest.raises(DependencyUnavailable): client.incorporate(INCORPORATION, RETRY_KEY)


def test_incorporacion_rechaza_replay_invalido_y_usuario_deshabilitado(incorporation_client):
    from app.infrastructure.clients import IncorporationRejected
    client, _, response = incorporation_client
    response["replayed"] = "unknown"
    with pytest.raises(DependencyUnavailable): client.incorporate(INCORPORATION, RETRY_KEY)
    response.update(status=403, body={"code": "USER_NOT_ENABLED", "detail": "private"})
    with pytest.raises(IncorporationRejected) as error: client.incorporate(INCORPORATION, RETRY_KEY)
    assert error.value.status == 403 and error.value.code == "USER_NOT_ENABLED"
