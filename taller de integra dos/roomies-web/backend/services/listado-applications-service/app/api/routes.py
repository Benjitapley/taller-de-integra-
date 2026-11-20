"""Adaptadores HTTP locales; reglas y SQL permanecen fuera de los routers."""
import json
import os
import hmac
from decimal import Decimal
from typing import Literal
from fastapi import APIRouter,Depends,Request,HTTPException,Query,Header
from starlette.exceptions import HTTPException as StarletteHTTPException
from starlette.concurrency import run_in_threadpool
from pydantic import BaseModel,ConfigDict,Field
from app.application.service import Publications
from app.domain.publications import available
from app.infrastructure.repository import PostgresPublications
from app.infrastructure.clients import UnavailableOccupancy, HttpOwners
from backend.service_runtime.security import confirmed_actor,admin_actor
from app.infrastructure.storage import SupabasePublicationImages, MAX_IMAGE_BYTES
from app.api.schemas import Publication, PublicationSaved, PublicationPage, Region, Commune, MULTIPART
from backend.service_runtime.contracts import DependencyUnavailable

router=APIRouter()


def service():
    return Publications(PostgresPublications(),UnavailableOccupancy(),SupabasePublicationImages(),HttpOwners())


def dto(row,occupancy):
    try: slots=available(row,occupancy)
    except DependencyUnavailable: slots=None
    return {"id_publicacion":row["id_publicacion"],"id":row["id_publicacion"],"titulo":row["titulo"],"tipo":row["tipo"],"descripcion":row["descripcion"],
            "precio":int(row["precio"]),"ubicacion":row["ubicacion"],"estado":row["estado"],
            "cupos_totales":row["cupos_totales"],"cupos":row["cupos_totales"],"cupos_disponibles":slots,
            "tipo_vivienda":row["tipo_vivienda"],"categoria":row["categoria"],"mascota":row["mascota"],
            "permitir_comentarios":row["permitir_comentarios"],"imagen":row.get("imagen"),"fecha_publicacion":row["fecha_publicacion"],
            "id_region":row.get("id_region"),"id_comuna":row.get("id_comuna"),"reglas":row.get("reglas",[]),"imagenes":row.get("imagenes",[])}


@router.get("/api/publicaciones",response_model=PublicationPage)
@router.get("/api/publicaciones/buscar",response_model=PublicationPage,deprecated=True)
def catalog(consulta: str|None=Query(None,max_length=250),precio_min:Decimal|None=Query(None,ge=0),precio_max:Decimal|None=Query(None,ge=0),
            cupos_min:int|None=Query(None,ge=1,le=2147483647),cupos_disponibles:int|None=Query(None,ge=0,le=2147483647),tipo_vivienda:Literal["casa","departamento","habitacion"]|None=None,
            mascota:Literal["si","no"]|None=None,categoria:Literal["busco","ofrezco"]|None=None,
            tipo:Literal["casa","departamento","habitacion"]|None=None,mascotas:Literal["si","no"]|None=None,
            personas:Literal["1","2","3"]|None=None,id_region:int|None=Query(None,ge=1),id_comuna:int|None=Query(None,ge=1),
            limite:int=Query(20,ge=1,le=100),cursor:str|None=Query(None,max_length=1024),offset:int|None=Query(None,ge=0),app=Depends(service)):
    if offset is not None:
        raise HTTPException(422,"Usa cursor para paginar publicaciones.")
    if cupos_disponibles is not None and (cupos_min is not None or personas is not None):
        raise HTTPException(422,"No combines cupos_disponibles con cupos_min o personas.")
    if precio_min is not None and precio_max is not None and precio_min>precio_max:
        raise HTTPException(422,"Rango de precios inválido.")
    if (tipo and tipo_vivienda and tipo!=tipo_vivienda) or (mascotas and mascota and mascotas!=mascota):
        raise HTTPException(422,"Filtros incompatibles.")
    if consulta and "\x00" in consulta:
        raise HTTPException(422,"Consulta inválida.")
    for price in (precio_min, precio_max):
        if price is not None and (not price.is_finite() or price != price.to_integral_value() or price > 999999999999):
            raise HTTPException(422,"El precio debe ser un entero CLP entre 0 y 999999999999.")
    filters={"consulta":consulta,"precio_min":precio_min,"precio_max":precio_max,"cupos_min":cupos_min or (int(personas) if personas else None),"cupos_disponibles":cupos_disponibles,"tipo_vivienda":tipo_vivienda or tipo,"mascota":mascota or mascotas,"categoria":categoria,"id_region":id_region,"id_comuna":id_comuna,"limite":limite,"cursor":cursor}
    page=app.list(filters)
    return {**page,"items":[dto(row,app.occupancy) for row in page["items"]]}


@router.get("/api/mis-publicaciones",response_model=PublicationPage,deprecated=True)
@router.get("/api/publicaciones/mias",response_model=PublicationPage)
def mine(limite:int=Query(20,ge=1,le=100),cursor:str|None=Query(None,max_length=1024),identity=Depends(confirmed_actor),app=Depends(service)):
    page=app.list({"limite":limite,"cursor":cursor},identity.user_id)
    return {**page,"items":[dto(row,app.occupancy) for row in page["items"]]}


@router.get("/api/regiones",response_model=list[Region])
def regions(app=Depends(service)):
    return app.repository.regions()


@router.get("/api/regiones/{id}/comunas",response_model=list[Commune])
def communes(id:int,app=Depends(service)):
    return app.repository.communes(id)


@router.get("/local/v1/publicaciones/resumen")
@router.get("/api/v1/publicaciones/resumen")
def my_count(identity=Depends(confirmed_actor),app=Depends(service)):
    return {"total_publicaciones":app.repository.count(identity.user_id)}


@router.get("/api/publicaciones/{id}/detalle",response_model=Publication,deprecated=True)
@router.get("/api/publicaciones/{id}",response_model=Publication)
def detail(id:int,app=Depends(service)):
    return dto(app.get(id),app.occupancy)


@router.get("/api/publicaciones/{id}/cupos")
def slots(id:int,app=Depends(service)):
    row=app.get(id)
    return {"id":id,"estado":row["estado"],"cupos_totales":row["cupos_totales"],"cupos_disponibles":available(row,app.occupancy)}


class OccupancyUpdate(BaseModel):
    model_config=ConfigDict(extra="forbid")
    ocupacion:int=Field(strict=True,ge=0,le=2147483647)
    version_ocupacion:int=Field(strict=True,ge=0,le=9223372036854775807)


def internal_service(x_roomies_service:str|None=Header(None)):
    expected=os.environ.get("ROOMIES_INTERNAL_TOKEN","")
    if len(expected)<32:
        raise HTTPException(503,"Falta configurar autenticación entre servicios.")
    if not x_roomies_service or not x_roomies_service.isascii() or not hmac.compare_digest(expected,x_roomies_service):
        raise HTTPException(403,"Servicio no autorizado.")


@router.put("/internal/publicaciones/{id}/ocupacion",dependencies=[Depends(internal_service)])
def occupancy_update(id:int,data:OccupancyUpdate,app=Depends(service)):
    return dto(app.occupancy_update(id,data.ocupacion,data.version_ocupacion),app.occupancy)


async def publication_form(request):
    try:
        form=await request.form(max_files=5,max_fields=18,max_part_size=100_000)
    except StarletteHTTPException as error:
        raise HTTPException(422,"Multipart inválido o exceso de imágenes/campos.") from error
    try:
        allowed={"titulo","descripcion","ubicacion","precio","tipo","categoria","tipo_vivienda","mascota","cupos_totales","permitir_comentarios","id_region","id_comuna","reglas","imagen","imagenes","imagenes_conservar"}
        if set(form)-allowed or any(len(form.getlist(k))!=1 for k in form if k!="imagenes") or ("imagen" in form and "imagenes" in form):
            raise HTTPException(422,"Campos no permitidos o repetidos.")
        data={k:v for k,v in form.items() if k not in {"imagen","imagenes","imagenes_conservar"}}
        if any(not isinstance(value,str) for value in data.values()):
            raise HTTPException(422,"Campos de publicación inválidos.")
        retained=None
        if "imagenes_conservar" in form:
            try: retained=json.loads(form["imagenes_conservar"])
            except (ValueError,TypeError): raise HTTPException(422,"imagenes_conservar debe ser una lista JSON de IDs.") from None
            if not isinstance(retained,list):
                raise HTTPException(422,"imagenes_conservar debe ser una lista JSON de IDs.")
        files=[]
        for image in form.getlist("imagenes")+form.getlist("imagen"):
            if not hasattr(image,"read") or not image.filename:
                raise HTTPException(422,"Imagen inválida.")
            if image.content_type not in {"image/jpeg","image/png","image/webp"}:
                raise HTTPException(415,"Usa imágenes JPEG, PNG o WebP.")
            files.append((await image.read(MAX_IMAGE_BYTES+1),image.content_type))
        return data,files,retained
    finally:
        await form.close()


@router.post("/api/publicaciones",status_code=201,response_model=PublicationSaved,openapi_extra=MULTIPART)
async def create(request:Request,identity=Depends(confirmed_actor),app=Depends(service)):
    data,images,retained=await publication_form(request)
    id=await run_in_threadpool(app.save,identity.user_id,data,images,retained=retained,key=request.headers.get("Idempotency-Key"))
    return {**dto(app.get(id,identity.user_id),app.occupancy),"mensaje":"Publicación creada"}


@router.put("/api/publicaciones/{id}",response_model=PublicationSaved,openapi_extra=MULTIPART)
async def edit(id:int,request:Request,identity=Depends(confirmed_actor),app=Depends(service)):
    previous=app.get(id,identity.user_id)
    data,images,retained=await publication_form(request)
    data.setdefault("tipo",previous["tipo"])
    data.setdefault("permitir_comentarios",previous["permitir_comentarios"])
    await run_in_threadpool(app.save,identity.user_id,data,images,id,retained,key=request.headers.get("Idempotency-Key"))
    return {**dto(app.get(id,identity.user_id),app.occupancy),"mensaje":"Publicación actualizada"}


@router.patch("/api/publicaciones/{id}/cerrar",response_model=Publication)
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
