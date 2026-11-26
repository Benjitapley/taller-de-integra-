from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4
import pytest
from app.models import ServiceError
from app.service import Convivencia

pytestmark = pytest.mark.usefixtures("empty_database")
REASON = {"id_usuario":2,"motivo":"Incumplimiento de reglas","confirmo":True}


def setup(service, ports, count=2):
    ports[1].owner = lambda publication: 1
    projections = []
    ports[1].occupancy = lambda payload: projections.append(payload)
    for user in range(2,2+count):
        assert service.incorporate(uuid4(), {"id_usuario":user,"id_publicacion":7,"id_postulacion":user+10,"version_capacidad":1})[0] == 201
    return projections


@pytest.mark.parametrize("actor", [2,99])
def test_ajeno_y_residente_no_retiran(service, ports, actor):
    setup(service,ports)
    with pytest.raises(ServiceError) as error:
        service.expel(1,actor,REASON)
    assert error.value.status == 403
    assert service.repository.get(1,2)["ocupacion"] == 2


def test_doble_click_concurrente_libera_una_plaza(service,ports,repository):
    setup(service,ports)
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: service.expel(1,1,REASON),range(2)))
    assert results[0] == results[1]
    assert results[0]["cupos_disponibles"] == 1
    with repository.transaction() as c:
        assert c.execute("SELECT count(*) AS n FROM convivencia_mensajeria.retiro").fetchone()["n"] == 1
        assert c.execute("SELECT version_ocupacion FROM convivencia_mensajeria.arriendo").fetchone()["version_ocupacion"] == 3
        audit = c.execute("SELECT * FROM convivencia_mensajeria.retiro").fetchone()
        assert audit["id_actor"] == 1 and audit["fecha"] is not None and audit["motivo"] == REASON["motivo"]
    with pytest.raises(ServiceError): repository.mine(2)
    for action in [lambda:repository.messages(1,2,None,20),lambda:repository.send_message(1,2,"Test","Texto",uuid4()),lambda:repository.tasks(1,2)]:
        with pytest.raises(ServiceError) as error: action()
        assert error.value.status == 403


def test_pendientes_reasignables_completadas_intactas(service,ports,repository):
    setup(service,ports)
    pending = repository.create_task(1,3,{"titulo":"Aseo","descripcion":None,"id_asignado":2})
    completed = repository.create_task(1,3,{"titulo":"Compra","descripcion":None,"id_asignado":2})
    repository.update_task(completed["id_tarea"],2,complete=True)
    service.expel(1,1,REASON)
    rows = {task["id_tarea"]:task for task in repository.tasks(1,3)}
    assert rows[pending["id_tarea"]]["id_asignado"] is None
    assert rows[completed["id_tarea"]]["id_asignado"] == 2
    assert rows[completed["id_tarea"]]["estado"] == "Completada"
    assert repository.update_task(pending["id_tarea"],3,assigned=3)["id_asignado"] == 3
    assert all(not member["es_responsable"] for member in repository.members(1,3))


def test_ultimo_finaliza_y_outbox_se_recupera(service,ports,repository,monkeypatch):
    projections = setup(service,ports,count=1)
    notifications = []
    monkeypatch.setattr("backend.service_runtime.notifications.send_notification",lambda event: notifications.append(event))
    ports[1].occupancy = lambda payload: (_ for _ in ()).throw(TimeoutError())
    result = service.expel(1,1,REASON)
    assert result["estado"] == "Finalizado"
    service.dispatch_departures()
    with repository.transaction() as c:
        assert c.execute("SELECT estado FROM convivencia_mensajeria.arriendo").fetchone()["estado"] == "Finalizado"
        assert c.execute("SELECT count(*) AS n FROM convivencia_mensajeria.retiro_outbox WHERE NOT enviado").fetchone()["n"] == 1
    ports[1].occupancy = lambda payload: projections.append(payload)
    restarted = Convivencia(repository,*ports)
    restarted.dispatch_departures()
    restarted.dispatch_departures()
    assert projections == [{"id_publicacion":7,"ocupacion":0,"version_ocupacion":2,"finalizado":True}]
    assert len(notifications) == 1
