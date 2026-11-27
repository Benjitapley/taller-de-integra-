from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import Mock
from uuid import UUID
import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient
from app.api import routes
from app.api.routes import router, service
from app.application.service import Publications
from app.domain.publications import validate_publication, available
from backend.service_runtime import security
from backend.service_runtime.contracts import Actor, RuleViolation, DependencyUnavailable
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


def test_catalogo_valida_comuna_con_catalogo_persistido(repository):
    web, _ = client(repository)
    # Código nacional fuera de la lista abreviada que entró por la fusión.
    assert web.get("/api/publicaciones?id_region=9&id_comuna=9112").status_code == 200
    assert web.get("/api/publicaciones?id_region=8&id_comuna=9112").status_code == 422


def test_detalle_incluye_propietario_solo_con_sesion_autorizada(monkeypatch):
    repository = Mock()
    repository.publication.return_value = {
        **validate_publication(DATA),
        "id_publicacion": 42,
        "id_usuario": 22,
        "estado": "Disponible",
        "fecha_publicacion": datetime.now(timezone.utc),
    }
    subject = UUID(int=1)
    verify = Mock(return_value=subject)
    identity = Mock(return_value=Actor(subject, 1, True, False))
    repository.viewer_application.return_value = {"id_postulacion": 77, "estado": "Pendiente"}
    repository.publication_rental.return_value = 123
    monkeypatch.setattr(security, "verified_subject", verify)
    monkeypatch.setattr(routes, "actor", identity)
    web, _ = client(repository)
    path = "/api/publicaciones/42/detalle"
    headers = {"Authorization": "Bearer test-session"}

    anonimo = web.get(path)
    assert anonimo.status_code == 200
    assert "id_propietario" not in anonimo.json()
    verify.assert_not_called()

    autorizado = web.get(path, headers=headers)
    assert autorizado.status_code == 200
    assert autorizado.json() == {**anonimo.json(), "id_propietario": 22}
    assert autorizado.headers["cache-control"] == "no-store"
    identity.assert_called_once_with("test-session")
    canonical = web.get("/api/publicaciones/42", headers=headers).json()
    assert canonical == {**anonimo.json(), "mi_postulacion": {"id_postulacion": 77, "estado": "Pendiente"}}
    identity.return_value = Actor(subject, 22, True, False)
    assert web.get("/api/publicaciones/42", headers=headers).json() == {**canonical, "id_arriendo": 123}
    repository.publication_rental.assert_called_once_with(42)

    identity.return_value = Actor(subject, 1, False, False)
    assert web.get(path, headers=headers).json() == anonimo.json()
    identity.side_effect = HTTPException(401, "Sesión revocada.")
    assert web.get(path, headers=headers).json() == anonimo.json()
    verify.side_effect = HTTPException(401, "Token inválido.")
    identity.reset_mock()
    assert web.get(path, headers=headers).json() == anonimo.json()
    identity.assert_not_called()


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
    assert {row["nombre"]:row["id_comuna"] for row in communes}["Padre Las Casas"]==9112
    assert {row["nombre"]:row["id_comuna"] for row in communes}["Angol"]==9201
    assert web.get("/api/regiones/999/comunas").status_code==404
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


@pytest.mark.parametrize("path", ["/api/publicaciones", "/api/publicaciones/mias"])
def test_e06_catalogo_y_propias_tres_paginas_completas(repository, admin_connection, path):
    ids = [add(repository) for _ in range(53)]
    admin_connection.execute("UPDATE listado_applications.publicacion SET fecha_publicacion='2026-11-26T12:00:00Z'")
    web, _ = client(repository)
    seen, cursor, pages = [], None, 0
    while True:
        result = web.get(path, params={"limite": 20, **({"cursor": cursor} if cursor else {})})
        assert result.status_code == 200, result.text
        page = result.json()
        seen.extend(row["id_publicacion"] for row in page["items"])
        pages += 1
        cursor = page["siguiente_cursor"]
        if cursor is None:
            break
    assert pages == 3 and seen == sorted(ids, reverse=True) and len(set(seen)) == 53


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


def test_consulta_interna_reportes_conserva_autorizacion_y_propietario(repository,monkeypatch):
    from backend.service_runtime.reporting_security import report_service_token
    monkeypatch.setenv("REPORTES_LISTADO_JWT_KEY","isolated-reports-listado-key-000000000000")
    id=add(repository,owner=22)
    web,_=client(repository)
    route=f"/internal/publicaciones/{id}"
    assert web.get(route).status_code==401
    assert web.get(route,headers={"Authorization":"Bearer invalid"}).status_code==403
    token=report_service_token("listado-applications","REPORTES_LISTADO_JWT_KEY")
    response=web.get(route,headers={"Authorization":"Bearer "+token})
    assert response.status_code==200
    assert response.json()=={"id_publicacion":id,"id_propietario":22,"tipo":"Arrendador","estado":"Disponible","cupos_totales":3}
    missing=web.get("/internal/publicaciones/999999",headers={"Authorization":"Bearer "+token})
    assert missing.status_code==404 and missing.json()=={"codigo":"PUBLICACION_NO_ENCONTRADA"}


def test_e01_dto_ubicacion_autor_reglas_y_filtro_privado():
    repository = Mock()
    row = {**validate_publication(DATA), "id_publicacion": 42, "id_usuario": 1,
           "estado": "Disponible", "fecha_publicacion": datetime.now(timezone.utc),
           "nombre_region": "La Araucanía", "nombre_comuna": "Temuco", "id_arriendo": 9}
    repository.publication.return_value = row
    repository.list_publications.return_value = [row]
    web, app = client(repository)
    app.owners = Mock()
    author = {"id_usuario": 1, "nombre": "Arrendadora de prueba", "foto": None}
    app.owners.summaries.return_value = {1: author}

    public = web.get("/api/publicaciones").json()["items"][0]
    assert public["region"] == {"id": 9, "nombre": "La Araucanía"}
    assert public["comuna"] == {"id": 9101, "nombre": "Temuco"}
    assert public["autor"] == author
    assert "id_arriendo" not in public and "reglas_arrendador" not in public
    assert web.get("/api/publicaciones/42").json()["reglas_arrendador"] == ["Respetar descanso"]
    assert web.get("/api/publicaciones/mias?estado=Disponible").json()["items"][0]["id_arriendo"] == 9
    assert repository.list_publications.call_args.args[0]["estado"] == "Disponible"
    assert repository.list_publications.call_args.args[1] == 1
    assert web.get("/api/publicaciones?cupos_disponibles=0").status_code == 422
    app.owners.summaries.side_effect = DependencyUnavailable()
    assert web.get("/api/publicaciones/42").json()["autor"] is None


def test_e01_reglas_canonicas_aplican_limites_y_conservan_alias():
    minimal = {key: value for key, value in DATA.items() if key not in {"reglas", "categoria", "mascota"}}
    checked = validate_publication({**minimal, "tipo_vivienda": "Habitacion", "reglas_arrendador": '["Sin humo"]'})
    assert (checked["tipo_vivienda"], checked["reglas"], checked["mascota"]) == ("habitacion", ["Sin humo"], "no")
    for invalid_rules in (["a"] * 21, ["a" * 301], [""], {"regla": "no"}):
        with pytest.raises(RuleViolation):
            validate_publication({**minimal, "reglas_arrendador": invalid_rules})
    with pytest.raises(RuleViolation):
        validate_publication({**DATA, "reglas_arrendador": ["Otra"]})
    assert validate_publication({**DATA, "reglas": ["a" * 301]})["reglas"] == ["a" * 301]


def test_e01_crear_editar_cerrar_y_cancelar_postulaciones(repository):
    web, app = client(repository)
    fields = {key: (None, value) for key, value in DATA.items()
              if key not in {"reglas", "ubicacion", "categoria", "mascota"}}
    fields["reglas_arrendador"] = (None, '["Sin humo"]')
    response = web.post("/api/publicaciones", files=fields)
    assert response.status_code == 201, response.text
    created = response.json()
    assert created["ubicacion"] == "Temuco, La Araucanía"
    assert created["cupos_disponibles"] == 3
    identifier = created["id_publicacion"]
    path = f"/api/publicaciones/{identifier}"

    response = web.put(path, files={**fields, "reglas_arrendador": (None, '["No fumar"]')})
    assert response.status_code == 200, response.text
    assert response.json()["fecha_publicacion"] == created["fecha_publicacion"]
    assert web.get(path).json()["reglas_arrendador"] == ["No fumar"]

    pending = app.postulate(21, identifier)["id_postulacion"]
    shortlisted = app.postulate(22, identifier)["id_postulacion"]
    app.decide(1, shortlisted, "Preseleccionada")
    app.occupancy_update(identifier, 1, 1)
    assert web.put(path, files=fields).status_code == 409
    assert web.put(path, files={key: value for key, value in fields.items() if key != "reglas_arrendador"}).status_code == 200
    assert web.get(path).json()["reglas_arrendador"] == ["No fumar"]

    for _ in range(2):
        closed = web.patch(path + "/cerrar")
        assert closed.status_code == 200 and closed.json()["estado"] == "Cerrada"
    assert web.get("/api/publicaciones").json()["items"] == []
    assert web.get("/api/publicaciones/mias?estado=Cerrada").json()["items"][0]["id_publicacion"] == identifier
    for application_id in (pending, shortlisted):
        row = repository.application(application_id)
        assert (row["estado"], row["motivo"]) == ("Cancelada", "Cierre de publicación")
        assert sum(event["event_key"] == f"postulacion:{application_id}:Cancelada" for event in repository.pending_events()) == 1
