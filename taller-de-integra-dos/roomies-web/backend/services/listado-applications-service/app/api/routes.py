"""Adaptadores HTTP locales; reglas y SQL permanecen fuera de los routers."""
import os
import base64
import json
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


REGIONES=[
    {"id_region":9,"nombre":"La Araucanía"},
]
COMUNAS={
    9:[
        {"id_comuna":9101,"nombre":"Temuco"},
        {"id_comuna":9102,"nombre":"Padre Las Casas"},
        {"id_comuna":9103,"nombre":"Angol"},
        {"id_comuna":9104,"nombre":"Villarrica"},
        {"id_comuna":9105,"nombre":"Pucón"},
        {"id_comuna":9106,"nombre":"Lautaro"},
        {"id_comuna":9107,"nombre":"Nueva Imperial"},
        {"id_comuna":9108,"nombre":"Carahue"},
        {"id_comuna":9109,"nombre":"Gorbea"},
        {"id_comuna":9110,"nombre":"Lonquimay"},
    ],
}


def service():
    return Publications(PostgresPublications(),UnavailableOccupancy(),Images(os.environ.get("ROOMIES_IMAGE_DIR"),"p_"),HttpOwners())


def dto(row,occupancy):
    try: slots=available(row,occupancy)
    except DependencyUnavailable: slots=None
    location={"id_region":None,"id_comuna":None}
    for region in REGIONES:
        for commune in COMUNAS.get(region["id_region"],[]):
            if row["ubicacion"] == f'{commune["nombre"]}, {region["nombre"]}':
                location={"id_region":region["id_region"],"id_comuna":commune["id_comuna"]}
    images=row.get("imagenes") or []
    if isinstance(images,str):
        try: images=json.loads(images)
        except (ValueError,TypeError): images=[]
    raw_price=Decimal(str(row["precio"]))
    price=int(raw_price) if raw_price==raw_price.to_integral_value() else str(raw_price)
    return {"id":row["id_publicacion"],"id_publicacion":row["id_publicacion"],"titulo":row["titulo"],"tipo":row["tipo"],"descripcion":row["descripcion"],
            "precio":price,"ubicacion":row["ubicacion"],"estado":row["estado"],
            "cupos_totales":row["cupos_totales"],"cupos":row["cupos_totales"],"cupos_disponibles":slots,
            "tipo_vivienda":row["tipo_vivienda"],"categoria":row["categoria"],"mascota":row["mascota"],
            "permitir_comentarios":row["permitir_comentarios"],"imagen":row.get("imagen"),"imagenes":images,
            **location,"fecha_publicacion":row["fecha_publicacion"]}


@router.get("/api/regiones")
def regions():
    return REGIONES


@router.get("/api/regiones/{id_region}/comunas")
def communes(id_region:int):
    if id_region not in {region["id_region"] for region in REGIONES}:
        raise HTTPException(404,"La región no existe.")
    return COMUNAS.get(id_region,[])


@router.get("/api/publicaciones")
@router.get("/api/publicaciones/buscar")
def catalog(consulta: str|None=Query(None,max_length=250),precio_min:Decimal|None=Query(None,ge=0),precio_max:Decimal|None=Query(None,ge=0),
            cupos_disponibles:int|None=Query(None,ge=1,le=2147483647),
            cupos_min:int|None=Query(None,ge=1,le=2147483647),tipo_vivienda:Literal["casa","departamento","habitacion"]|None=None,
            mascota:Literal["si","no"]|None=None,categoria:Literal["busco","ofrezco"]|None=None,
            id_region:int|None=Query(None,ge=1),id_comuna:int|None=Query(None,ge=1),
            limite:int=Query(20,ge=1,le=100),cursor:str|None=None,
            tipo:Literal["casa","departamento","habitacion"]|None=None,mascotas:Literal["si","no"]|None=None,
            personas:Literal["1","2","3"]|None=None,offset:int=Query(0,ge=0,le=1000000),app=Depends(service)):
    if precio_min is not None and precio_max is not None and precio_min>precio_max:
        raise HTTPException(422,"Rango de precios inválido.")
    if cupos_disponibles is not None and cupos_min is not None:
        raise HTTPException(422,"No combines cupos_disponibles con cupos_min.")
    if id_comuna is not None and id_region is not None:
        if id_comuna not in {commune["id_comuna"] for commune in COMUNAS.get(id_region,[])}:
            raise HTTPException(422,"La comuna no pertenece a la región.")
    if (tipo and tipo_vivienda and tipo!=tipo_vivienda) or (mascotas and mascota and mascotas!=mascota):
        raise HTTPException(422,"Filtros incompatibles.")
    if consulta and "\x00" in consulta:
        raise HTTPException(422,"Consulta inválida.")
    cursor_data=None
    if cursor:
        try:
            padding="="*((4-len(cursor)%4)%4)
            cursor_data=json.loads(base64.urlsafe_b64decode(cursor+padding).decode())
            if not isinstance(cursor_data,dict) or not isinstance(cursor_data.get("fecha"),str) or not isinstance(cursor_data.get("id"),int):
                raise ValueError()
        except Exception:
            raise HTTPException(422,"Cursor inválido.")
    filters={"consulta":consulta,"precio_min":precio_min,"precio_max":precio_max,"cupos_min":cupos_min or (int(personas) if personas else None),"cupos_disponibles":cupos_disponibles,"tipo_vivienda":tipo_vivienda or tipo,"mascota":mascota or mascotas,"categoria":categoria,"limite":limite,"offset":offset,"cursor":cursor_data}
    rows=app.list(filters)
    items=[dto(row,app.occupancy) for row in rows[:limite]]
    siguiente_cursor=None
    if len(rows)>limite:
        last=rows[limite-1]
        siguiente_cursor=base64.urlsafe_b64encode(json.dumps({
            "fecha":str(last["fecha_publicacion"]),
            "id":last["id_publicacion"],
        },separators=(",",":")).encode()).decode().rstrip("=")
    return {"items":items,"siguiente_cursor":siguiente_cursor}


@router.get("/api/mis-publicaciones")
def mine(identity=Depends(confirmed_actor),app=Depends(service)):
    return [dto(row,app.occupancy) for row in app.list({},identity.user_id)]


@router.get("/local/v1/publicaciones/resumen")
@router.get("/api/v1/publicaciones/resumen")
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
    form=await request.form(max_files=5,max_fields=40,max_part_size=5*1024*1024)
    allowed={"titulo","descripcion","id_region","id_comuna","precio","tipo","categoria","tipo_vivienda","mascota","cupos_totales","permitir_comentarios","imagenes","imagenes_conservar"}
    if set(form)-allowed or any(len(form.getlist(k))!=1 for k in form if k not in {"imagenes","imagenes_conservar"}):
        raise HTTPException(422,"Campos no permitidos o repetidos.")
    data={k:v for k,v in form.items() if k not in {"imagenes","imagenes_conservar"}}
    if "id_region" in data and "id_comuna" in data:
        try:
            region_id=int(str(data["id_region"]))
            commune_id=int(str(data["id_comuna"]))
        except (TypeError,ValueError):
            raise HTTPException(422,"Región o comuna inválidas.")
        commune=next((item for item in COMUNAS.get(region_id,[]) if item["id_comuna"]==commune_id),None)
        if commune is None:
            raise HTTPException(422,"La comuna no pertenece a la región.")
        region=next((item for item in REGIONES if item["id_region"]==region_id),None)
        data["ubicacion"]=f'{commune["nombre"]}, {region["nombre"]}'
    uploads=form.getlist("imagenes")
    if any(not hasattr(image,"read") for image in uploads):
        raise HTTPException(422,"Imagen inválida.")
    content=[]
    for image in uploads:
        if not image.filename: continue
        raw=await image.read(5*1024*1024+1)
        if len(raw)>5*1024*1024: raise HTTPException(413,"Cada imagen puede pesar como máximo 5 MB.")
        content.append(raw)
    try:
        keep_ids=[int(value) for value in form.getlist("imagenes_conservar")]
        if any(str(value)!=str(raw) or value<1 for value,raw in zip(keep_ids,form.getlist("imagenes_conservar"))): raise ValueError()
    except (TypeError,ValueError):
        raise HTTPException(422,"La selección de imágenes existentes no es válida.") from None
    if len(content)+len(keep_ids)>5: raise HTTPException(422,"Puedes adjuntar hasta 5 imágenes.")
    return data,content,keep_ids


@router.post("/api/publicaciones",status_code=201)
async def create(request:Request,identity=Depends(confirmed_actor),app=Depends(service)):
    data,images,_=await publication_form(request)
    id=app.save(identity.user_id,data,images=images)
    return dto(app.get(id,identity.user_id),app.occupancy)


@router.put("/api/publicaciones/{id}")
async def edit(id:int,request:Request,identity=Depends(confirmed_actor),app=Depends(service)):
    data,images,keep_ids=await publication_form(request)
    previous=app.get(id,identity.user_id)
    data.setdefault("tipo",previous["tipo"])
    data.setdefault("permitir_comentarios",previous["permitir_comentarios"])
    app.save(identity.user_id,data,images=images,id=id,keep_image_ids=keep_ids)
    return dto(app.get(id,identity.user_id),app.occupancy)


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
