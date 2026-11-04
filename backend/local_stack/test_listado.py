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
