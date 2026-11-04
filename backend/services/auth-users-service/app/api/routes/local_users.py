"""Contratos LOCALES v1; no sustituyen los DTO compartidos pendientes con TI4."""
import hmac
import os
from datetime import date
from uuid import UUID
from fastapi import APIRouter, Depends, HTTPException, Request, Query
from pydantic import BaseModel, ConfigDict, Field
from app.application.local_users import Users
from app.infrastructure.persistence.local_users import PostgresUsers
from app.infrastructure.security.local_provider import confirmed_email
from backend.service_runtime.security import access_token, verified_claims
from backend.service_runtime.images import Images

router = APIRouter()


def users():
    return Users(PostgresUsers())


def identity(token=Depends(access_token)):
    claims=verified_claims(token)
    subject=UUID(claims["sub"])
    try:
        session_id=UUID(claims["session_id"])
        if str(session_id)!=claims["session_id"]: raise ValueError()
    except (KeyError,TypeError,ValueError):
        raise HTTPException(401,"Sesión de identidad no válida.") from None
    if PostgresUsers().is_revoked(session_id):
        raise HTTPException(401,"Sesión revocada.")
    return subject, confirmed_email(token, subject)


def administrator(who=Depends(identity), service=Depends(users)):
    subject, confirmed = who
    allowed = os.environ.get("ROOMIES_ADMIN_SUBJECTS", "").split(",")
    if not confirmed or str(subject) not in allowed:
        raise HTTPException(403,"Acceso administrativo no permitido.")
    service.own(subject)
    return who


class Initialization(BaseModel):
    model_config = ConfigDict(extra="forbid")
    nombre: str = Field(min_length=1,max_length=200)
    fecha_nacimiento: date


@router.post("/local/v1/perfil/inicializacion")
def initialize(data: Initialization, who=Depends(identity), service=Depends(users)):
    user = service.initialize(who[0],data.nombre,data.fecha_nacimiento,who[1])
    return {"id_usuario":user.id_usuario,"inicializado":True}


@router.get("/internal/v1/identidad")
def internal_identity(who=Depends(identity), service=Depends(users)):
    user=service.own(who[0])
    return {"subject":str(who[0]),"user_id":user.id_usuario,"email_confirmed":who[1],
            "administrator":str(who[0]) in os.environ.get("ROOMIES_ADMIN_SUBJECTS", "").split(",")}


@router.get("/local/v1/perfil")
def profile(who=Depends(identity), service=Depends(users)):
    user=service.own(who[0])
    return {"nombre":user.nombre,"edad":user.age(),"ocupacion":user.ocupacion,"ciudad":user.ciudad,
            "breve_descripcion":user.breve_descripcion,"sobre_mi":user.sobre_mi,"foto_perfil":user.foto_perfil,
            "verificado":who[1],"edad_calculada":True}


@router.post("/local/v1/sesion/revocar")
def revoke_session(token=Depends(access_token),who=Depends(identity),service=Depends(users)):
    service.own(who[0])
    PostgresUsers().revoke(UUID(verified_claims(token)["session_id"]),who[0])
    return {"success":True}


class LocalProfilePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ocupacion: str | None = Field(None, max_length=100)
    ciudad: str | None = Field(None, max_length=100)
    breve_descripcion: str | None = Field(None, max_length=255)
    sobre_mi: str | None = Field(None, max_length=5000)
    presupuesto: int | None = Field(None, ge=0, le=2147483647, strict=True)
    zona_interes: str | None = Field(None, max_length=250)


@router.patch("/local/v1/perfil")
def patch_local_profile(data: LocalProfilePatch, who=Depends(identity), service=Depends(users)):
    if not who[1]:
        raise HTTPException(403, "Confirma tu correo.")
    return service.update(who[0], data.model_dump(exclude_unset=True)).public()


@router.put("/local/v1/perfil")
async def update_profile(request: Request, who=Depends(identity), service=Depends(users)):
    if not who[1]:
        raise HTTPException(403,"Confirma tu correo.")
    form=await request.form(max_files=1,max_fields=8,max_part_size=5*1024*1024)
    if set(form)-{"edad","ocupacion","ciudad","breve_descripcion","sobre_mi","foto"}:
        raise HTTPException(422,"Campos no editables.")
    if any(len(form.getlist(key)) != 1 for key in form):
        raise HTTPException(422,"Campos repetidos.")
    user=service.own(who[0])
    age=form.get("edad", "")
    if age not in {"",str(user.age())}:
        raise HTTPException(422,"La edad se calcula desde tu fecha de nacimiento.")
    changes={key:form.get(key, "") for key in ("ocupacion","ciudad","breve_descripcion","sobre_mi")}
    images=Images(os.environ.get("ROOMIES_IMAGE_DIR"),"u_")
    reference=None
    try:
        image=form.get("foto")
        if image is not None and getattr(image,"filename",""):
            reference=images.save(await image.read(5*1024*1024+1))
            changes["foto_perfil"]=reference
        service.update(who[0],changes)
    except Exception:
        images.delete(reference)
        raise
    return {"success":True}


@router.get("/local/v1/usuarios/publicos")
def public_profiles(ids: str | None=None, presupuesto_max: int | None=Query(None,ge=0,le=2147483647), zona: str | None=Query(None,max_length=250), ocupacion: str | None=Query(None,max_length=100), service=Depends(users)):
    filters={k:v for k,v in {"presupuesto_max":presupuesto_max,"zona":zona,"ocupacion":ocupacion}.items() if v is not None}
    if ids is not None:
        try:
            parsed=[int(v) for v in ids.split(",")]
            if not 1<=len(parsed)<=100 or any(v<1 for v in parsed): raise ValueError()
        except ValueError:
            raise HTTPException(422,"Identificadores inválidos.") from None
        filters["ids"]=parsed
    return [user.public() for user in service.repository.public_search(filters)]


class Notification(BaseModel):
    model_config=ConfigDict(extra="forbid")
    event_key: str=Field(pattern=r"^postulacion:[1-9][0-9]*:(Preseleccionada|Aceptada|Rechazada|Cancelada)$",max_length=150)
    id_usuario: int=Field(gt=0)
    referencia_id: int=Field(gt=0)
    estado: str=Field(pattern=r"^(Preseleccionada|Aceptada|Rechazada|Cancelada)$")


@router.post("/internal/v1/notificaciones")
def notify(data: Notification, request: Request, service=Depends(users)):
    expected=os.environ.get("ROOMIES_INTERNAL_TOKEN", "")
    if len(expected)<32 or not hmac.compare_digest(request.headers.get("x-roomies-service", ""),expected):
        raise HTTPException(403,"Servicio no autorizado.")
    if data.event_key != f"postulacion:{data.referencia_id}:{data.estado}":
        raise HTTPException(422,"Evento inconsistente.")
    service.repository.notify(data.model_dump())
    return {"success":True}


@router.get("/local/v1/notificaciones")
def notifications(who=Depends(identity),service=Depends(users)):
    return service.repository.notifications(service.own(who[0]).id_usuario)


@router.get("/internal/v1/resumen")
def summary(_=Depends(administrator),service=Depends(users)):
    return {"usuarios":service.repository.count()}
