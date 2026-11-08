"""Adaptadores HTTP locales; reglas y SQL permanecen fuera de los routers."""
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
