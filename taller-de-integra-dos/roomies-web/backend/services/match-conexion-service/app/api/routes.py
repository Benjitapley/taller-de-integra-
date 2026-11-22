"""Adaptadores compatibles con las rutas actuales de conexiones."""
from typing import Literal
from fastapi import APIRouter,Depends,Query,Response
from pydantic import BaseModel,ConfigDict,Field
from app.application.service import Connections
from app.infrastructure.repository import PostgresConnections
from app.infrastructure.clients import HttpProfiles,HttpPublications
from backend.service_runtime.security import confirmed_actor,admin_actor
from backend.service_runtime.contracts import RuleViolation

router=APIRouter(prefix="/conexiones")


def service(): return Connections(PostgresConnections(),HttpProfiles())


class Create(BaseModel):
    model_config=ConfigDict(extra="forbid")
    id_receptor_FK:int=Field(gt=0)
    id_solicitante_FK:int|None=Field(default=None,gt=0)


class Respond(BaseModel):
    model_config=ConfigDict(extra="forbid")
    estado:Literal["Aceptada","Rechazada"]


@router.post("/",status_code=201)
def send(data:Create,identity=Depends(confirmed_actor),app=Depends(service)):
    return app.send(identity.user_id,data.id_receptor_FK,data.id_solicitante_FK)


@router.put("/{id}")
def respond(id:int,data:Respond,identity=Depends(confirmed_actor),app=Depends(service)):
    return app.respond(identity.user_id,id,data.estado)


@router.delete("/{id}",status_code=204)
def delete(id:int,identity=Depends(confirmed_actor),app=Depends(service)):
    app.delete(identity.user_id,id)
    return Response(status_code=204)


@router.get("/recibidas")
def received(identity=Depends(confirmed_actor),app=Depends(service)):
    return app.own(identity.user_id,"recibidas")


@router.get("/recibidas/{user_id}")
def received_compat(user_id:int,identity=Depends(confirmed_actor),app=Depends(service)):
    return app.own(identity.user_id,"recibidas",user_id)


@router.get("/enviadas")
def sent(identity=Depends(confirmed_actor),app=Depends(service)):
    return app.own(identity.user_id,"enviadas")


@router.get("/aceptadas")
def accepted(identity=Depends(confirmed_actor),app=Depends(service)):
    return app.own(identity.user_id,"aceptadas")


@router.get("/usuarios/buscar")
def search(presupuesto_max:int|None=Query(None,ge=0,le=2147483647),zona:str|None=Query(None,max_length=250),ocupacion:str|None=Query(None,max_length=100),app=Depends(service)):
    return app.profiles.search({k:v for k,v in {"presupuesto_max":presupuesto_max,"zona":zona,"ocupacion":ocupacion}.items() if v is not None})


@router.get("/usuarios/otros")
def discover_people(
    presupuesto_max: int | None = Query(None, ge=0, le=2147483647),
    zona: str | None = Query(None, max_length=250),
    ocupacion: str | None = Query(None, max_length=100),
    identity=Depends(confirmed_actor),
    app=Depends(service),
):
    filters = {
        key: value
        for key, value in {"presupuesto_max": presupuesto_max, "zona": zona, "ocupacion": ocupacion}.items()
        if value is not None
    }
    return app.profiles.search({**filters, "excluir_id": identity.user_id})


@router.get("/usuarios/{id}")
def public_profile(id:int,app=Depends(service)):
    profiles=app.profiles.search({"ids":str(id)})
    if not profiles: raise RuleViolation("Usuario no encontrado.",404)
    return profiles[0]


@router.get("/publicaciones/buscar")
def publications(consulta:str|None=Query(None,max_length=250),tipo:Literal["casa","departamento","habitacion"]|None=None,mascotas:Literal["si","no"]|None=None):
    return HttpPublications().search({k:v for k,v in {"consulta":consulta,"tipo_vivienda":tipo,"mascota":mascotas}.items() if v is not None})


@router.get("/internal/v1/resumen")
def summary(_=Depends(admin_actor),app=Depends(service)):
    return {"conexiones":app.repository.count()}
