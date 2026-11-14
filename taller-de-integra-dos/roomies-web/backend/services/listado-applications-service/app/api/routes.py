"""Adaptadores HTTP locales; reglas y SQL permanecen fuera de los routers."""
import hmac
import os
from decimal import Decimal
from typing import Literal
from fastapi import APIRouter,Depends,Request,HTTPException,Query
from pydantic import BaseModel,ConfigDict,Field
from app.application.service import Publications
from app.domain.publications import available
from app.infrastructure.repository import PostgresPublications
from app.infrastructure.clients import UnavailableOccupancy, HttpOwners
from backend.service_runtime.security import confirmed_actor,admin_actor
from backend.service_runtime.images import Images
from backend.service_runtime.contracts import DependencyUnavailable

router=APIRouter()


def service():
    return Publications(PostgresPublications(),UnavailableOccupancy(),Images(os.environ.get("ROOMIES_IMAGE_DIR"),"p_"),HttpOwners())


def internal_authorized(request: Request):
    expected=os.environ.get("ROOMIES_INTERNAL_TOKEN","")
    supplied=request.headers.get("x-roomies-service","")
    if len(expected)<32 or not hmac.compare_digest(supplied,expected):
        raise HTTPException(403,"Servicio no autorizado.")


def dto(row,occupancy):
    try: slots=available(row,occupancy)
    except DependencyUnavailable: slots=None
    return {"id":row["id_publicacion"],"titulo":row["titulo"],"tipo":row["tipo"],"descripcion":row["descripcion"],
            "precio":float(row["precio"]),"ubicacion":row["ubicacion"],"estado":row["estado"],
            "cupos_totales":row["cupos_totales"],"cupos":row["cupos_totales"],"cupos_disponibles":slots,
            "tipo_vivienda":row["tipo_vivienda"],"categoria":row["categoria"],"mascota":row["mascota"],
            "permitir_comentarios":row["permitir_comentarios"],"imagen":row.get("imagen"),"fecha_publicacion":row["fecha_publicacion"]}


@router.get("/api/publicaciones")
@router.get("/api/publicaciones/buscar")
def catalog(consulta: str|None=Query(None,max_length=250),precio_min:Decimal|None=Query(None,ge=0),precio_max:Decimal|None=Query(None,ge=0),
            cupos_min:int|None=Query(None,ge=1,le=2147483647),tipo_vivienda:Literal["casa","departamento","habitacion"]|None=None,
            mascota:Literal["si","no"]|None=None,categoria:Literal["busco","ofrezco"]|None=None,
            tipo:Literal["casa","departamento","habitacion"]|None=None,mascotas:Literal["si","no"]|None=None,
            personas:Literal["1","2","3"]|None=None,limite:int=Query(100,ge=1,le=100),offset:int=Query(0,ge=0,le=1000000),app=Depends(service)):
    if precio_min is not None and precio_max is not None and precio_min>precio_max:
        raise HTTPException(422,"Rango de precios inválido.")
    if (tipo and tipo_vivienda and tipo!=tipo_vivienda) or (mascotas and mascota and mascotas!=mascota):
        raise HTTPException(422,"Filtros incompatibles.")
    if consulta and "\x00" in consulta:
        raise HTTPException(422,"Consulta inválida.")
    filters={"consulta":consulta,"precio_min":precio_min,"precio_max":precio_max,"cupos_min":cupos_min or (int(personas) if personas else None),"tipo_vivienda":tipo_vivienda or tipo,"mascota":mascota or mascotas,"categoria":categoria,"limite":limite,"offset":offset}
    return [dto(row,app.occupancy) for row in app.list(filters)]


@router.get("/api/mis-publicaciones")
def mine(identity=Depends(confirmed_actor),app=Depends(service)):
    return [dto(row,app.occupancy) for row in app.list({},identity.user_id)]


@router.get("/local/v1/publicaciones/resumen")
def my_count(identity=Depends(confirmed_actor),app=Depends(service)):
    return {"total_publicaciones":app.repository.count(identity.user_id)}


@router.get("/api/publicaciones/{id}/detalle")
def detail(id:int,app=Depends(service)):
    return dto(app.get(id),app.occupancy)


@router.get("/api/publicaciones/{id}")
def private_detail(id:int,identity=Depends(confirmed_actor),app=Depends(service)):
    return dto(app.get(id,identity.user_id),app.occupancy)


@router.get("/api/publicaciones/{id}/cupos")
def slots(id:int,app=Depends(service)):
    row=app.get(id)
    return {"id":id,"estado":row["estado"],"cupos_totales":row["cupos_totales"],"cupos_disponibles":available(row,app.occupancy)}


class CapacityReservation(BaseModel):
    model_config=ConfigDict(extra="forbid")
    event_key:str=Field(pattern=r"^postulacion:[1-9][0-9]*:Aceptada$",max_length=100)
    id_postulacion:int=Field(gt=0,strict=True)
    id_usuario:int=Field(gt=0,strict=True)


class CapacityRelease(BaseModel):
    model_config=ConfigDict(extra="forbid")
    event_key:str=Field(pattern=r"^postulacion:[1-9][0-9]*:Aceptada$",max_length=100)


class OccupancyUpdate(BaseModel):
    model_config=ConfigDict(extra="forbid")
    event_key:str=Field(min_length=1,max_length=200)
    clave_incorporacion:str|None=Field(default=None,pattern=r"^postulacion:[1-9][0-9]*:Aceptada$",max_length=100)
    id_reserva:int|None=Field(default=None,gt=0,strict=True)
    id_usuario:int=Field(gt=0,strict=True)
    id_publicacion:int=Field(gt=0,strict=True)
    version_ocupacion:int=Field(ge=0,strict=True)
    cupos_totales:int=Field(gt=0,strict=True)
    cupos_ocupados:int=Field(ge=0,strict=True)
    estado:Literal["Activa","Cerrada"]


@router.get("/internal/publicaciones/{id}")
def internal_publication(id:int,request:Request,app=Depends(service)):
    internal_authorized(request)
    return app.repository.internal_publication(id)


@router.post("/internal/publicaciones/{id}/reservas",status_code=201)
def reserve_capacity(id:int,data:CapacityReservation,request:Request,app=Depends(service)):
    internal_authorized(request)
    if data.event_key!=f"postulacion:{data.id_postulacion}:Aceptada":
        raise HTTPException(422,"Clave de reserva inconsistente.")
    return app.repository.reserve_capacity(
        data.event_key,id,data.id_postulacion,data.id_usuario
    )


@router.delete("/internal/publicaciones/{id}/reservas")
def release_capacity(id:int,data:CapacityRelease,request:Request,app=Depends(service)):
    internal_authorized(request)
    app.repository.release_capacity(data.event_key,id)
    return {"liberada":True}


@router.put("/internal/publicaciones/{id}/ocupacion")
def update_occupancy(id:int,data:OccupancyUpdate,request:Request,app=Depends(service)):
    internal_authorized(request)
    if data.id_publicacion!=id:
        raise HTTPException(422,"La publicación no coincide con la ruta.")
    if (data.id_reserva is None)!=(data.clave_incorporacion is None):
        raise HTTPException(422,"La reserva y la clave de incorporación son obligatorias en conjunto.")
    return app.repository.update_occupancy(data.model_dump())


async def publication_form(request):
    form=await request.form(max_files=1,max_fields=12,max_part_size=5*1024*1024)
    allowed={"titulo","descripcion","ubicacion","precio","tipo","categoria","tipo_vivienda","mascota","cupos_totales","permitir_comentarios","imagen"}
    if set(form)-allowed or any(len(form.getlist(k))!=1 for k in form):
        raise HTTPException(422,"Campos no permitidos o repetidos.")
    data={k:v for k,v in form.items() if k!="imagen"}
    image=form.get("imagen")
    if image is not None and not hasattr(image,"read"):
        raise HTTPException(422,"Imagen inválida.")
    content=await image.read(5*1024*1024+1) if image and image.filename else None
    return data,content


@router.post("/api/publicaciones",status_code=201)
async def create(request:Request,identity=Depends(confirmed_actor),app=Depends(service)):
    data,image=await publication_form(request)
    id=app.save(identity.user_id,data,image)
    return {"id":id,"mensaje":"Publicación creada"}


@router.put("/api/publicaciones/{id}")
async def edit(id:int,request:Request,identity=Depends(confirmed_actor),app=Depends(service)):
    data,image=await publication_form(request)
    previous=app.get(id,identity.user_id)
    data.setdefault("tipo",previous["tipo"])
    data.setdefault("permitir_comentarios",previous["permitir_comentarios"])
    app.save(identity.user_id,data,image,id)
    return {"mensaje":"Publicación actualizada"}


@router.patch("/api/publicaciones/{id}/cerrar")
def close(id:int,identity=Depends(confirmed_actor),app=Depends(service)):
    return dto(app.close(identity.user_id,id),app.occupancy)


@router.post("/api/publicaciones/{id}/postulaciones",status_code=201)
def postulate(id:int,identity=Depends(confirmed_actor),app=Depends(service)):
    return app.postulate(identity.user_id,id)


@router.get("/api/postulaciones/mias")
def my_applications(identity=Depends(confirmed_actor),app=Depends(service)):
    return app.repository.applications(owner=identity.user_id)


@router.get("/api/publicaciones/{id}/postulantes")
def applicants(id:int,identity=Depends(confirmed_actor),app=Depends(service)):
    return app.applicants(identity.user_id,id)


class Decision(BaseModel):
    model_config=ConfigDict(extra="forbid")
    estado:Literal["Preseleccionada","Aceptada","Rechazada","Cancelada"]
    motivo:str|None=Field(default=None,max_length=1000)


@router.patch("/api/postulaciones/{id}/estado")
def decide(id:int,data:Decision,identity=Depends(confirmed_actor),app=Depends(service)):
    result=app.decide(identity.user_id,id,data.estado,data.motivo)
    # Sprint 2 registra la decisión; no crea un arriendo ni consume cupos.
    return {**result,"incorporacion_pendiente":result["estado"]=="Aceptada"}


@router.get("/internal/v1/resumen")
def summary(_=Depends(admin_actor),app=Depends(service)):
    return {"publicaciones":app.repository.count()}


@router.get("/api/admin/publicaciones")
def admin_publications(limite:int=Query(20,ge=1,le=100),pagina:int=Query(1,ge=1,le=100000),_=Depends(admin_actor),app=Depends(service)):
    rows=app.repository.admin_list(limite,pagina)
    return {"items":[{k:v for k,v in dto(row,app.occupancy).items() if k in {"id","titulo","precio","ubicacion","estado","cupos_totales"}} for row in rows[:limite]],"pagina":pagina,"hay_mas":len(rows)>limite}
