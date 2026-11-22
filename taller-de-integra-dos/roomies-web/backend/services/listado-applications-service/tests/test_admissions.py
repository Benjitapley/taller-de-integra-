"""SQL real de Listado; los efectos del proveedor se simulan explícitamente."""
from concurrent.futures import ThreadPoolExecutor
from threading import Event, Lock
from unittest.mock import Mock
from uuid import uuid4
import pytest
from app.application.admissions import Admissions, AdmissionError
from app.application.service import Publications
from app.domain.publications import validate_publication
from app.infrastructure.repository import PostgresPublications
from app.infrastructure.clients import IncorporationRejected
from backend.service_runtime.contracts import RuleViolation, DependencyUnavailable

DATA={"titulo":"Aviso C03","descripcion":"Datos ficticios","ubicacion":"Temuco","precio":"100000","cupos_totales":"1","tipo":"Arrendador","categoria":"ofrezco","tipo_vivienda":"habitacion","mascota":"no","id_region":"9","id_comuna":"9101"}


def service(): return Publications(PostgresPublications(),Mock(),Mock())


def setup(repository,total=1,people=(22,23)):
    publication=repository.create(1,validate_publication({**DATA,"cupos_totales":str(total)}))
    applications=[]
    for person in people:
        application=repository.postulate(publication,person)
        repository.change(application["id_postulacion"],"Preseleccionada",None)
        applications.append(application["id_postulacion"])
    return publication,applications


class Peer:
    def __init__(self):
        self.receipts={}
        self.lock=Lock()
        self.calls=[]
        self.timeout=False
        self.offline=False
        self.reserved=Event()
        self.resume=None
        self.reject=None

    def incorporate(self,payload,key):
        self.calls.append((payload,key))
        if self.offline: raise DependencyUnavailable()
        callback=Admissions(service())
        try: callback.reserve(payload["id_publicacion"],key,{**payload,"id_operacion":key})
        except AdmissionError as error: raise IncorporationRejected(error.code) from None
        self.reserved.set()
        if self.resume is not None: assert self.resume.wait(10)
        if self.reject:
            callback.reservation_update(payload["id_publicacion"],key,key)
            raise IncorporationRejected(self.reject)
        with self.lock:
            if key not in self.receipts:
                body={"id_incorporacion":key,"id_arriendo":42,"id_publicacion":payload["id_publicacion"],"id_usuario":payload["id_usuario"],"estado":"Activa","confirmacion_publicacion":"Pendiente"}
                projection={"id_arriendo":42,"ocupacion":len(self.receipts)+1,"version_ocupacion":len(self.receipts)+1}
                self.receipts[key]=(body,projection)
            body,projection=self.receipts[key]
            if self.timeout:
                self.timeout=False
                raise DependencyUnavailable()
            callback.reservation_update(payload["id_publicacion"],key,key,projection)
            return body


def test_ultimo_cupo_concurrente_solo_confirma_una_aceptacion(repository):
    publication,applications=setup(repository)
    peer=Peer()
    def accept(application):
        return Admissions(service(),peer).accept(1,application,None,str(uuid4()))
    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes=list(pool.map(accept,applications))
    assert sorted(status for status,_ in outcomes)==[200,409]
    assert len(peer.receipts)==1
    rows=[repository.application(application) for application in applications]
    assert sorted(row["estado"] for row in rows)==["Aceptada","Preseleccionada"]
    assert repository.publication(publication)["ocupacion_confirmada"]==1
    assert Admissions(service()).operations.reserved(publication)==0


def test_timeout_despues_commit_y_reinicio_reusa_uuid_sin_falso_exito(repository):
    publication,(application,)=setup(repository,people=(22,))
    peer=Peer();peer.timeout=True
    key=str(uuid4())
    status,pending=Admissions(service(),peer).accept(1,application,None,key)
    assert status==202 and pending["estado"]=="Preseleccionada"
    assert pending["incorporacion_pendiente"] and pending["id_arriendo"] is None
    assert pending["operacion"]["id_operacion"]==key
    assert service().list({})["items"]==[]  # Una reserva firme no se anuncia disponible.
    assert Admissions(service(),peer).accept(1,application,None,key)[0]==200
    assert len(peer.receipts)==1 and {call[1] for call in peer.calls}=={key}
    accepted=Admissions(service()).detail(22,application)
    assert accepted["estado"]=="Aceptada" and accepted["id_arriendo"]==42
    assert not accepted["incorporacion_pendiente"]
    with pytest.raises(RuleViolation) as error: Admissions(service()).detail(99,application)
    assert error.value.status==404


def test_replay_y_conflictos_de_clave_y_actor(repository):
    _,(application,)=setup(repository,people=(22,))
    peer=Peer();key=str(uuid4())
    first=Admissions(service(),peer).accept(1,application,"Elegido",key)
    replay=Admissions(service(),peer).accept(1,application,"Elegido",key)
    assert first==replay and len(peer.calls)==1
    with pytest.raises(AdmissionError) as error:
        Admissions(service(),peer).accept(1,application,"Otro cuerpo",key)
    assert error.value.code=="IDEMPOTENCY_CONFLICT"
    with pytest.raises(RuleViolation) as error:
        Admissions(service(),peer).accept(99,application,"Elegido",key)
    assert error.value.status==403
    with pytest.raises(AdmissionError): Admissions(service(),peer).accept(1,application,None,str(uuid4()))


def test_409_compensado_deja_preseleccionada_y_admite_nuevo_intento(repository):
    publication,(application,)=setup(repository,people=(22,))
    peer=Peer();peer.reject="USER_ALREADY_ACTIVE";key=str(uuid4())
    status,rejected=Admissions(service(),peer).accept(1,application,None,key)
    assert status==409 and rejected["estado"]=="Preseleccionada"
    assert rejected["operacion"]["estado"]=="Rechazada"
    assert not rejected["incorporacion_pendiente"]
    assert Admissions(service()).operations.reservation(key)["estado"]=="Liberada"
    assert Admissions(service(),peer).accept(1,application,None,key)==(status,rejected)
    peer.reject=None
    assert Admissions(service(),peer).accept(1,application,None,str(uuid4()))[0]==200
    assert repository.publication(publication)["ocupacion_confirmada"]==1
    assert Admissions(service(),peer).accept(1,application,None,key)==(status,rejected)


def test_recuperacion_automatica_tras_caida_de_red(repository):
    _,(application,)=setup(repository,people=(22,))
    peer=Peer();peer.offline=True
    key=str(uuid4())
    assert Admissions(service(),peer).accept(1,application,None,key)[0]==202
    peer.offline=False
    Admissions(service(),peer).recover()
    assert repository.application(application)["estado"]=="Aceptada"
    assert {call[1] for call in peer.calls}=={key}


def test_cierre_y_capacidad_no_intercalan_con_aceptacion(repository):
    publication,(application,)=setup(repository,people=(22,))
    peer=Peer();peer.resume=Event()
    with ThreadPoolExecutor(max_workers=1) as pool:
        acceptance=pool.submit(Admissions(service(),peer).accept,1,application,None,str(uuid4()))
        assert peer.reserved.wait(10)
        with pytest.raises(RuleViolation) as error: service().close(1,publication)
        assert error.value.status==409
        with pytest.raises(RuleViolation): repository.update(publication,{"cupos_totales":2})
        peer.resume.set()
        assert acceptance.result()[0]==200
    assert service().close(1,publication)["estado"]=="Cerrada"


def test_cierre_primero_impide_intencion_y_reserva(repository):
    publication,(application,)=setup(repository,people=(22,))
    service().close(1,publication)
    peer=Peer()
    with pytest.raises(RuleViolation): Admissions(service(),peer).accept(1,application,None,str(uuid4()))
    assert not peer.calls


def test_confirmacion_idempotente_versionada_y_no_libera_reserva_ganadora(repository):
    publication,(application,)=setup(repository,people=(22,))
    peer=Peer();key=str(uuid4())
    assert Admissions(service(),peer).accept(1,application,None,key)[0]==200
    callback=Admissions(service())
    projection=peer.receipts[key][1]
    assert callback.reservation_update(publication,key,key,projection)=={"success":True}
    with pytest.raises(AdmissionError): callback.reservation_update(publication,key,key)
    with pytest.raises(AdmissionError): callback.reservation_update(publication,key,key,{**projection,"ocupacion":0})
    assert repository.publication(publication)["ocupacion_confirmada"]==1


@pytest.mark.parametrize("capacity",[2,3])
def test_proyeccion_adelantada_no_duplica_ocupacion_ni_anuncia_reservas_pendientes(repository,capacity):
    from app.api.routes import dto
    from app.api.schemas import Publication
    publication,applications=setup(repository,total=capacity)
    peer=Peer();peer.offline=True
    keys=[str(uuid4()),str(uuid4())]
    callbacks=Admissions(service())
    for application,key in zip(applications,keys):
        assert Admissions(service(),peer).accept(1,application,None,key)[0]==202
        operation=callbacks.operations.operation(key)
        callbacks.reserve(publication,key,{**callbacks.payload(operation),"id_operacion":key})
    callbacks.reservation_update(publication,keys[1],keys[1],{"id_arriendo":42,"ocupacion":2,"version_ocupacion":2})
    publication_dto=dto(repository.publication(publication),Mock())
    assert Publication.model_validate(publication_dto).cupos_disponibles==0
    assert service().list({"cupos_disponibles":1})["items"]==[]
    callbacks.reservation_update(publication,keys[0],keys[0],{"id_arriendo":42,"ocupacion":1,"version_ocupacion":1})
    row=repository.publication(publication)
    assert row["ocupacion_confirmada"]==2 and row["version_ocupacion"]==2
    assert dto(row,Mock())["cupos_disponibles"]==capacity-2
    assert len(service().list({"cupos_disponibles":1})["items"])==(1 if capacity==3 else 0)
