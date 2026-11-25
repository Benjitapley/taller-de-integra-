from contextlib import nullcontext
from unittest.mock import Mock
import pytest
from app.application.service import Publications
from backend.service_runtime.contracts import RuleViolation


def publication():
    repository=Mock()
    repository.transaction.return_value=nullcontext()
    repository.publication.return_value={"id_publicacion":7,"cupos_totales":2,"version_ocupacion":2,"ocupacion_confirmada":1}
    service=Publications(repository,Mock(),Mock())
    service.get=Mock(return_value={})
    return service,repository


def test_ultimo_cierra_en_misma_transaccion_de_proyeccion():
    service,repository=publication()
    service.occupancy_update(7,0,3,True)
    repository.update_occupancy.assert_called_once_with(7,0,3)
    repository.close.assert_called_once_with(7)


def test_evento_finalizado_antiguo_no_cierra_ni_cambia_ocupacion():
    service,repository=publication()
    service.occupancy_update(7,0,1,True)
    repository.update_occupancy.assert_not_called()
    repository.close.assert_not_called()


def test_finalizar_con_residentes_rechazado():
    service,repository=publication()
    with pytest.raises(RuleViolation): service.occupancy_update(7,1,3,True)
    repository.close.assert_not_called()



def test_mis_publicaciones_incluye_enlace_al_arriendo_confirmado():
    from fastapi import FastAPI
    from fastapi.testclient import TestClient
    from app.api.routes import router, service as dependency
    from backend.service_runtime.security import confirmed_actor
    app=FastAPI()
    app.include_router(router)
    instance,repository=publication()
    row={"id_publicacion":7,"titulo":"Prueba","tipo":"Arrendador","descripcion":"Espacio","precio":1000,"ubicacion":"Temuco","estado":"Activa","cupos_totales":2,"ocupacion_confirmada":1,"tipo_vivienda":"habitacion","categoria":"ofrezco","mascota":"no","permitir_comentarios":False,"fecha_publicacion":"2026-11-24T12:00:00Z"}
    instance.list=Mock(return_value={"items":[row],"siguiente_cursor":None})
    repository.publication_rental.return_value=4
    app.dependency_overrides[dependency]=lambda:instance
    app.dependency_overrides[confirmed_actor]=lambda:type("Actor",(),{"user_id":1})()
    with TestClient(app) as client:
        response=client.get("/api/publicaciones/mias")
    assert response.status_code == 200
    assert response.json()["items"][0]["id_arriendo"] == 4
    repository.publication_rental.assert_called_once_with(7)
