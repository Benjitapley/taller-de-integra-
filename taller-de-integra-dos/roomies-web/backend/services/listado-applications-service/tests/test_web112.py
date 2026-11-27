"""SCRUM-112: listas privadas y retiro contra PostgreSQL efímero real."""
from unittest.mock import Mock
import pytest
from app.application.service import Publications
from app.application.admissions import Admissions
from app.domain.publications import validate_publication
from backend.service_runtime.contracts import RuleViolation

DATA={"titulo":"Aviso D02","descripcion":"Datos de prueba","ubicacion":"Temuco","precio":"100000","cupos_totales":"3","tipo":"Arrendador","categoria":"ofrezco","tipo_vivienda":"habitacion","mascota":"no","id_region":"9","id_comuna":"9101"}


def test_postulantes_superan_cien_con_fechas_empatadas_y_cursor_privado(repository,admin_connection):
    publication=repository.create(1,validate_publication(DATA))
    admin_connection.execute("INSERT INTO listado_applications.postulacion(id_publicacion,id_usuario,fecha_postulacion) SELECT %s,n,'2026-11-01T00:00:00Z' FROM generate_series(10,134) n",(publication,))
    service=Publications(repository,Mock(),Mock())
    ids=[]
    cursor=None
    while True:
        page=service.application_page(1,publication,limit=20,cursor=cursor)
        ids.extend(row["id_postulacion"] for row in page["items"])
        cursor=page["siguiente_cursor"]
        if cursor is None: break
    assert len(ids)==len(set(ids))==125
    assert ids==sorted(ids,reverse=True)
    cursor=service.application_page(1,publication,limit=20)["siguiente_cursor"]
    for args in [{"actor_id":10},{"actor_id":1,"state":"Rechazada"}]:
        with pytest.raises(RuleViolation): service.application_page(publication=publication,cursor=cursor,**args)
    with pytest.raises(RuleViolation) as error:
        service.application_page(999,publication,cursor="invalid")
    assert error.value.status==404
    assert len(service.application_page(10)["items"])==1


def test_retiro_es_del_postulante_idempotente_y_conserva_aceptacion(repository):
    publication=repository.create(1,validate_publication(DATA))
    row=repository.postulate(publication,22)
    service=Publications(repository,Mock(),Mock())
    with pytest.raises(RuleViolation) as error: service.withdraw(1,row["id_postulacion"])
    assert error.value.status==403
    for _ in range(2):
        result=service.withdraw(22,row["id_postulacion"])
        assert result["estado"]=="Cancelada" and result["motivo"]=="Retiro voluntario"
    assert len(repository.pending_events())==1
    second=repository.postulate(publication,23)
    repository.change(second["id_postulacion"],"Aceptada",None)
    with pytest.raises(RuleViolation) as error: service.withdraw(23,second["id_postulacion"])
    assert error.value.status==409


def test_e06_mis_postulaciones_tres_paginas_filtro_y_contexto(repository, admin_connection):
    publications = [repository.create(1, validate_publication(DATA)) for _ in range(53)]
    for publication in publications:
        repository.postulate(publication, 22)
    admin_connection.execute("UPDATE listado_applications.postulacion SET fecha_postulacion='2026-11-26T12:00:00Z'")
    service = Publications(repository, Mock(), Mock())
    ids, cursor, pages = [], None, 0
    while True:
        page = service.application_page(22, limit=20, cursor=cursor, state="Pendiente")
        ids.extend(row["id_postulacion"] for row in page["items"])
        cursor = page["siguiente_cursor"]
        pages += 1
        if cursor is None:
            break
    assert pages == 3 and len(ids) == len(set(ids)) == 53 and ids == sorted(ids, reverse=True)
    cursor = service.application_page(22, state="Pendiente")["siguiente_cursor"]
    for args in ({"actor_id": 23, "state": "Pendiente"}, {"actor_id": 22, "state": "Cancelada"}):
        with pytest.raises(RuleViolation):
            service.application_page(cursor=cursor, **args)
