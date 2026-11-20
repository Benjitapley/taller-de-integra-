from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import Mock
import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient
from app.api.routes import router, service
from app.application.service import Publications
from app.domain.publications import validate_publication, available
from backend.service_runtime.contracts import RuleViolation, DependencyUnavailable
from backend.service_runtime.http import configure
from backend.service_runtime.security import confirmed_actor


DATA={"titulo":"Aviso de prueba","descripcion":"Espacio de prueba","ubicacion":"Temuco","precio":"250000","cupos_totales":"3","tipo":"Arrendador","categoria":"ofrezco","tipo_vivienda":"habitacion","mascota":"no","id_region":"9","id_comuna":"9101","reglas":'["Respetar descanso"]'}


def add(repository,owner=1,**changes):
    data=validate_publication({**DATA,**changes})
    repository.validate_location(data["id_region"],data["id_comuna"])
    return repository.create(owner,data)


def client(repository):
    app=FastAPI()
    configure(app)
    app.include_router(router)
    publications=Publications(repository,Mock(),Mock())
    app.dependency_overrides[service]=lambda:publications
    app.dependency_overrides[confirmed_actor]=lambda:type("Identity",(),{"user_id":1})()
    return TestClient(app),publications


@pytest.mark.parametrize("price",["0","999999999999"])
def test_precio_clp_ida_vuelta_exacta(repository,price):
    id=add(repository,precio=price)
    web,_=client(repository)
    row=web.get(f"/api/publicaciones/{id}").json()
    assert row["precio"]==int(price) and type(row["precio"]) is int
    assert row["id_publicacion"]==id and row["tipo"]=="Arrendador"
    assert row["id_region"]==9 and row["id_comuna"]==9101
    assert row["reglas"]==["Respetar descanso"]


@pytest.mark.parametrize("price",["-1","0.1","999999999999.1","1000000000000","NaN","Infinity"])
def test_precio_no_admite_fracciones_ni_fuera_de_rango(repository,price):
    with pytest.raises(RuleViolation): add(repository,precio=price)
    assert repository.count()==0


def test_catalogos_nacionales_y_comuna_region(repository):
    web,_=client(repository)
    regions=web.get("/api/regiones").json()
    communes=web.get("/api/regiones/9/comunas").json()
    assert len(regions)==16 and len(communes)==32
    assert all(row["id_region"]==9 for row in communes)
    with pytest.raises(RuleViolation): add(repository,id_comuna="13101")
    id=add(repository,id_region="13",id_comuna="13101",ubicacion="Santiago")
    assert repository.publication(id)["id_region"]==13


def test_mas_de_dos_paginas_fechas_empatadas_y_cuenta(repository,admin_connection):
    ids=[add(repository) for _ in range(7)]
    add(repository,owner=2)
    admin_connection.execute("UPDATE listado_applications.publicacion SET fecha_publicacion=%s",(datetime(2026,11,19,tzinfo=timezone.utc),))
    web,_=client(repository)
    seen=[]
    cursor=None
    for page in range(4):
        response=web.get("/api/publicaciones/mias",params={"limite":2,**({"cursor":cursor} if cursor else {})})
        assert response.status_code==200
        data=response.json()
        seen.extend(item["id_publicacion"] for item in data["items"])
        cursor=data["siguiente_cursor"]
        assert bool(cursor)==(page<3)
    assert seen==sorted(ids,reverse=True) and len(seen)==len(set(seen))
    first=web.get("/api/publicaciones/mias",params={"limite":2}).json()["siguiente_cursor"]
    assert web.get("/api/publicaciones",params={"cursor":first}).status_code==422
    web.app.dependency_overrides[confirmed_actor]=lambda:type("Identity",(),{"user_id":2})()
    assert web.get("/api/publicaciones/mias",params={"limite":2,"cursor":first}).status_code==422


def test_filtro_cupos_exactos_con_confirmacion_retiro_y_cursor(repository):
    ids=[add(repository) for _ in range(6)]
    web,publications=client(repository)
    for id,count in zip(ids,[2,1,0,1,1,1]): publications.occupancy_update(id,count,1)
    response=web.get("/api/publicaciones",params={"cupos_disponibles":2,"limite":2})
    page=response.json()
    assert response.status_code==200 and len(page["items"])==2
    assert all(item["cupos_disponibles"]==2 for item in page["items"])
    assert web.get("/api/publicaciones",params={"cupos_disponibles":3,"cursor":page["siguiente_cursor"]}).status_code==422
    assert web.get("/api/publicaciones",params={"cupos_disponibles":2,"cupos_min":1}).status_code==422
    assert web.get("/api/publicaciones",params={"cursor":"incorrecto"}).status_code==422
    assert web.get("/api/publicaciones",params={"cursor":""}).status_code==422
    publications.occupancy_update(ids[0],1,2)
    exact=web.get("/api/publicaciones",params={"cupos_disponibles":2}).json()["items"]
    assert ids[0] in [item["id_publicacion"] for item in exact]
    publications.occupancy_update(ids[0],2,1)
    assert repository.publication(ids[0])["ocupacion_confirmada"]==1
    with pytest.raises(RuleViolation): publications.occupancy_update(ids[0],0,2)
    minimum=web.get("/api/publicaciones",params={"cupos_min":2}).json()["items"]
    assert set(item["cupos_disponibles"] for item in minimum)=={2,3}


def test_ocupacion_desconocida_no_inventa_cupos(repository,admin_connection):
    id=add(repository)
    admin_connection.execute("UPDATE listado_applications.publicacion SET ocupacion_confirmada=NULL WHERE id_publicacion=%s",(id,))
    web,_=client(repository)
    assert web.get("/api/publicaciones").json()["items"]==[]
    assert web.get(f"/api/publicaciones/{id}").json()["cupos_disponibles"] is None


def test_edicion_preserva_fecha_y_cierre_fotos(repository):
    id=add(repository)
    before=repository.publication(id)["fecha_publicacion"]
    repository.update(id,validate_publication({**DATA,"titulo":"Cambio","precio":"999999999999"}))
    assert repository.publication(id)["fecha_publicacion"]==before
    repository.close(id)
    assert repository.publication(id)["estado"]=="Cerrada"


def test_sync_ocupacion_requiere_servicio_interno(repository):
    import os
    id=add(repository)
    web,_=client(repository)
    route=f"/internal/publicaciones/{id}/ocupacion"
    assert web.put(route,json={"ocupacion":1,"version_ocupacion":1}).status_code==403
    assert web.put(route,json={"ocupacion":1,"version_ocupacion":1},headers={"X-Roomies-Service":os.environ["ROOMIES_INTERNAL_TOKEN"]}).status_code==200
    assert repository.publication(id)["ocupacion_confirmada"]==1


def test_migracion_rechaza_precio_heredado_sin_redondear(repository,admin_connection):
    from pathlib import Path
    import psycopg
    id=add(repository,precio="123")
    migration=Path(__file__).resolve().parents[1]/"migrations/001_publicaciones_contract.up.sql"
    with pytest.raises(psycopg.errors.RaiseException,match="Precios heredados requieren corrección explícita"):
        with admin_connection.transaction():
            admin_connection.execute("ALTER TABLE listado_applications.publicacion RENAME TO publicacion_contract_hold")
            admin_connection.execute("CREATE TABLE listado_applications.publicacion(id_publicacion bigint,precio numeric(14,2))")
            admin_connection.execute("INSERT INTO listado_applications.publicacion VALUES(42,123.45)")
            admin_connection.execute(migration.read_text(encoding="utf-8"))
    assert repository.publication(id)["precio"]==123
