from concurrent.futures import ThreadPoolExecutor
from types import SimpleNamespace
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from pydantic import ValidationError

from app import departures
from app.main import create_app, confirmed_actor
from app.models import ExpulsionCreate, ServiceError

pytestmark = pytest.mark.usefixtures('empty_database')


@pytest.fixture
def prepared(service, ports, monkeypatch):
    publications = ports[1]
    publications.owner = lambda publication: 1
    publications.projections = []
    publications.departure = lambda payload: publications.projections.append(payload)
    notices = []
    monkeypatch.setattr('backend.service_runtime.notifications.send_notification', notices.append)
    for user in (2, 3):
        service.incorporate(uuid4(), {'id_usuario': user, 'id_publicacion': 7, 'id_postulacion': user + 7, 'version_capacidad': 1})
    return service, publications, notices


def data(user=2):
    return ExpulsionCreate(id_usuario=user, motivo='Incumplimiento de reglas', confirmo=True)


def test_retiro_revoca_historial_desasigna_y_es_idempotente(prepared):
    service, publications, notices = prepared
    repository = service.repository
    pending = repository.create_task(1, 3, {'titulo': 'Aseo', 'descripcion': None, 'id_asignado': 2})
    completed = repository.create_task(1, 2, {'titulo': 'Compras', 'descripcion': None, 'id_asignado': 2})
    repository.update_task(completed['id_tarea'], 2, {}, complete=True)
    conversation = repository.conversations(2)[0]['id_conversacion']
    repository.send_message(conversation, 2, 'Persona', 'Mensaje privado', uuid4())
    result = departures.withdraw(service, 1, 1, data())
    assert result['ocupacion'] == 1 and result['id_responsable'] is None
    assert result['estado'] == 'Activo' and not result['sincronizacion_pendiente']
    for operation in [lambda: repository.conversation(conversation, 2), lambda: repository.messages(conversation, 2, None, 20),
                      lambda: repository.send_message(conversation, 2, 'Persona', 'No permitido', uuid4()),
                      lambda: repository.task_list(1, 2, 0, 20),
                      lambda: repository.update_task(pending['id_tarea'], 2, {'id_asignado': 3})]:
        with pytest.raises(ServiceError) as error:
            operation()
        assert error.value.status == 403
    tasks = repository.task_list(1, 3, 0, 20)
    assert tasks[0]['id_asignado'] is None
    assert tasks[1]['id_asignado'] == 2 and tasks[1]['estado'] == 'Completada'
    assert repository.update_task(pending['id_tarea'], 3, {'id_asignado': 3})['id_asignado'] == 3
    assert departures.withdraw(service, 1, 1, data())['ocupacion'] == 1
    assert len(publications.projections) == len(notices) == 1
    assert notices[0]['tipo'] == 'expulsion'


def test_ultimo_integrante_doble_click_y_recuperacion(prepared):
    service, publications, notices = prepared
    departures.withdraw(service, 1, 1, data())
    def unavailable(payload):
        raise TimeoutError()
    publications.departure = unavailable
    with ThreadPoolExecutor(max_workers=2) as executor:
        results = list(executor.map(lambda _: departures.withdraw(service, 1, 1, data(3)), range(2)))
    assert all(result['ocupacion'] == 0 and result['estado'] == 'Finalizado' for result in results)
    assert all(result['sincronizacion_pendiente'] for result in results)
    publications.departure = publications.projections.append
    service.recover()
    assert publications.projections[-1]['finalizado'] is True
    assert publications.projections[-1]['version_ocupacion'] == 4
    assert len(notices) == 2
    assert not departures.withdraw(service, 1, 1, data(3))['sincronizacion_pendiente']


@pytest.mark.parametrize('actor', [2, 3, 90, 99])
def test_solo_dueno_incluido_admin_sin_privilegio_especial(prepared, actor):
    service, publications, notices = prepared
    with pytest.raises(ServiceError) as error:
        departures.withdraw(service, 1, actor, data())
    assert error.value.status == 403
    assert service.repository.get(1, 2)['ocupacion'] == 2
    assert not publications.projections and not notices


@pytest.mark.parametrize('change', [{'motivo': ''}, {'motivo': '   '}, {'motivo': 'a'*501}, {'confirmo': False}, {'confirmo': 1}, {'id_usuario': True}])
def test_motivo_y_confirmacion_estrictos(change):
    with pytest.raises(ValidationError):
        ExpulsionCreate.model_validate({**data().model_dump(), **change})


def test_http_permisos_tareas_y_cursor_tras_retiro(prepared):
    service, _, _ = prepared
    app = create_app(service, run_recovery=False)
    actor = SimpleNamespace(user_id=1)
    app.dependency_overrides[confirmed_actor] = lambda: actor
    with TestClient(app) as client:
        assert client.get('/api/arriendos/1').json()['puede_retirar'] is True
        page = client.get('/api/arriendos/1/integrantes?limite=1').json()
        assert len(page['items']) == 1 and page['siguiente_cursor']
        cursor = page['siguiente_cursor']
        assert client.get('/api/arriendos/1/integrantes', params={'cursor': cursor}).json()['items'][0]['id_usuario'] == 3
        assert client.get('/api/arriendos/1/integrantes', params={'cursor': cursor, 'activos': False}).status_code == 422
        assert client.post('/api/arriendos/1/expulsiones', json={**data().model_dump(), 'confirmo': False}).status_code == 422
        assert client.post('/api/arriendos/1/expulsiones', json=data().model_dump()).status_code == 200
        actor.user_id = 2
        assert client.get('/api/arriendos/mio').status_code == 404
        assert client.get('/api/arriendos/1/integrantes').status_code == 403
        assert client.get('/api/arriendos/1/tareas').status_code == 403
        assert client.post('/api/arriendos/1/tareas', json={'titulo': 'No permitido'}).status_code == 403


def test_no_reingreso(prepared):
    service, _, _ = prepared
    departures.withdraw(service, 1, 1, data())
    status, result, _ = service.incorporate(uuid4(), {'id_usuario': 2, 'id_publicacion': 7, 'id_postulacion': 99, 'version_capacidad': 1})
    assert status == 409 and result['code'] == 'REENTRY_FORBIDDEN'
