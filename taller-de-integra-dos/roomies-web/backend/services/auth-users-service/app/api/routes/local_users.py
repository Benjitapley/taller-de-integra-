"""Contratos comunes del recorrido acordados entre Web, Móvil (TI4) y Servicios — SCRUM-93."""
import hmac
import os
import re
from datetime import date, datetime
from typing import Annotated, Literal
from uuid import UUID
from fastapi import APIRouter, Depends, Header, HTTPException, Request, Query, Path
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator
from starlette.datastructures import UploadFile
from app.application.local_users import Users, require_confirmed_email
from app.application.notifications import APPLICATION_TYPE, MAX_ID, notification_page
from app.domain.local_users import User
from app.infrastructure.persistence.local_users import PostgresUsers
from app.infrastructure.security.local_provider import provider_user, email_is_confirmed, has_admin_role
from app.infrastructure.security.admission_provider import SupabaseAdmissionIdentity
from backend.service_runtime.contracts import DependencyUnavailable
from backend.service_runtime.security import access_token, verified_claims
from backend.service_runtime.notifications import PRODUCERS
from backend.service_runtime.reporting_security import verify_service_token
from backend.service_runtime.images import Images

router = APIRouter()


def users():
    return Users(PostgresUsers())


def identity(request: Request, token=Depends(access_token)):
    claims=verified_claims(token)
    subject=UUID(claims["sub"])
    try:
        session_id=UUID(claims["session_id"])
        if str(session_id)!=claims["session_id"]: raise ValueError()
    except (KeyError,TypeError,ValueError):
        raise HTTPException(401,"Sesión de identidad no válida.") from None
    if PostgresUsers().is_revoked(session_id):
        raise HTTPException(401,"Sesión revocada.")
    record=provider_user(token,subject)
    request.state.verified_provider_user=record
    return subject, email_is_confirmed(record)


def administrator(request: Request, who=Depends(identity), service=Depends(users)):
    subject, confirmed = who
    if not confirmed or not has_admin_role(getattr(request.state,"verified_provider_user",{})):
        raise HTTPException(403,"Acceso administrativo no permitido.")
    service.own(subject)
    return who


class Initialization(BaseModel):
    model_config = ConfigDict(extra="forbid")
    nombre: str = Field(min_length=1,max_length=200)
    fecha_nacimiento: date

    @field_validator("fecha_nacimiento", mode="before")
    @classmethod
    def require_iso_date(cls, value: object) -> object:
        if not isinstance(value, str) or not re.fullmatch(r"[0-9]{4}-[0-9]{2}-[0-9]{2}", value):
            raise ValueError("Usa una fecha en formato YYYY-MM-DD.")
        return value


class InitializedProfile(BaseModel):
    id_usuario: int
    inicializado: bool = True


@router.post("/local/v1/perfil/inicializacion", response_model=InitializedProfile)
@router.post("/api/v1/perfil/inicializacion", response_model=InitializedProfile)
def initialize(data: Initialization, who=Depends(identity), service=Depends(users)):
    user = service.initialize(who[0], data.nombre, data.fecha_nacimiento, who[1])
    return InitializedProfile(id_usuario=user.id_usuario)


@router.get("/internal/v1/identidad")
def internal_identity(request: Request, who=Depends(identity), service=Depends(users)):
    user=service.own(who[0])
    return {"subject":str(who[0]),"user_id":user.id_usuario,"email_confirmed":who[1],
            "administrator":who[1] and has_admin_role(getattr(request.state,"verified_provider_user",{})),
            "nombre":user.nombre}


def admission_service(x_roomies_service: Annotated[str | None, Header()] = None):
    expected = os.environ.get("ROOMIES_INTERNAL_TOKEN", "")
    if len(expected) < 32 or not expected.isascii():
        raise DependencyUnavailable()
    if not x_roomies_service or not x_roomies_service.isascii() or not hmac.compare_digest(expected, x_roomies_service):
        raise HTTPException(403, "Servicio no autorizado.")


def admission_identity():
    return SupabaseAdmissionIdentity()


@router.get("/internal/v1/usuarios/{id}/habilitacion", dependencies=[Depends(admission_service)])
def admission_eligibility(id: Annotated[int, Path(gt=0, le=9223372036854775807)], service=Depends(users), provider=Depends(admission_identity)):
    user = service.repository.get_by_id(id)
    enabled = user is not None and user.supabase_user_id is not None and provider.enabled(user.supabase_user_id)
    if type(enabled) is not bool:
        raise DependencyUnavailable()
    return {"id_usuario": id, "habilitado": enabled}


class OwnProfile(BaseModel):
    id_usuario: int
    nombre: str
    edad: int | None
    ocupacion: str | None
    ciudad: str | None
    breve_descripcion: str | None
    sobre_mi: str | None
    foto_perfil: str | None
    verificado: bool
    edad_calculada: bool

    @classmethod
    def from_user(cls, user: User, confirmed: bool) -> "OwnProfile":
        age = user.age()
        return cls(
            id_usuario=user.id_usuario,
            nombre=user.nombre,
            edad=age,
            ocupacion=user.ocupacion,
            ciudad=user.ciudad,
            breve_descripcion=user.breve_descripcion,
            sobre_mi=user.sobre_mi,
            foto_perfil=user.foto_perfil,
            verificado=confirmed,
            edad_calculada=age is not None,
        )


@router.get("/usuarios/me", response_model=OwnProfile)
@router.get("/local/v1/perfil", response_model=OwnProfile)
@router.get("/api/v1/perfil", response_model=OwnProfile)
def profile(who=Depends(identity), service=Depends(users)):
    return OwnProfile.from_user(service.own(who[0]), who[1])


@router.post("/local/v1/sesion/revocar")
@router.post("/api/v1/sesion/revocar")
def revoke_session(token=Depends(access_token),who=Depends(identity),service=Depends(users)):
    service.own(who[0])
    PostgresUsers().revoke(UUID(verified_claims(token)["session_id"]),who[0])
    return {"success":True}


class OwnProfilePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ocupacion: str | None = Field(None, max_length=100)
    ciudad: str | None = Field(None, max_length=100)
    breve_descripcion: str | None = Field(None, max_length=255)
    sobre_mi: str | None = Field(None, max_length=5000)
    presupuesto: int | None = Field(None, ge=0, le=2147483647, strict=True)
    zona_interes: str | None = Field(None, max_length=250)

    @field_validator("presupuesto", mode="before")
    @classmethod
    def clear_blank_budget(cls, value: object) -> object:
        return None if isinstance(value, str) and not value.strip() else value


@router.patch("/usuarios/me", response_model=OwnProfile)
@router.patch("/local/v1/perfil", response_model=OwnProfile)
@router.patch("/api/v1/perfil", response_model=OwnProfile)
def patch_profile(data: OwnProfilePatch, who=Depends(identity), service=Depends(users)):
    require_confirmed_email(who[1])
    updated = service.update(who[0], data.model_dump(exclude_unset=True))
    return OwnProfile.from_user(updated, who[1])


@router.put("/local/v1/perfil")
@router.put("/api/v1/perfil")
async def update_profile(request: Request, who=Depends(identity), service=Depends(users)):
    require_confirmed_email(who[1])
    content_type = request.headers.get("content-type", "").partition(";")[0].strip().lower()
    if content_type not in {"multipart/form-data", "application/x-www-form-urlencoded"}:
        raise HTTPException(422, "Envía el formulario de perfil.")
    text_fields = ("ocupacion", "ciudad", "breve_descripcion", "sobre_mi")
    async with request.form(max_files=1, max_fields=8, max_part_size=5 * 1024 * 1024) as form:
        if set(form) - {*text_fields, "edad", "foto"}:
            raise HTTPException(422, "Campos no editables.")
        if any(len(form.getlist(key)) != 1 for key in form):
            raise HTTPException(422, "Campos repetidos.")
        age = form.get("edad", "")
        calculated_age = service.own(who[0]).age()
        if age != "" and (calculated_age is None or age != str(calculated_age)):
            raise HTTPException(422, "La edad se calcula desde tu fecha de nacimiento.")
        changes = {key: form.get(key, "") for key in text_fields}
        photo = form.get("foto")
        if photo not in (None, "") and not isinstance(photo, UploadFile):
            raise HTTPException(422, "Envía una fotografía válida.")
        images = Images(os.environ.get("ROOMIES_IMAGE_DIR"), "u_")
        reference = None
        try:
            if isinstance(photo, UploadFile) and photo.filename:
                reference = images.save(await photo.read(5 * 1024 * 1024 + 1))
                if reference:
                    changes["foto_perfil"] = reference
            service.update(who[0], changes)
        except Exception:
            images.delete(reference)
            raise
    return {"success": True}


@router.get("/local/v1/usuarios/publicos")
@router.get("/api/v1/usuarios/publicos")
def public_profiles(ids: str | None=None, incluir_foto: bool=False, presupuesto_max: int | None=Query(None,ge=0,le=2147483647), zona: str | None=Query(None,max_length=250), ocupacion: str | None=Query(None,max_length=100), excluir_id: int | None=Query(None,ge=1,le=2147483647), service=Depends(users)):
    filters={k:v for k,v in {"presupuesto_max":presupuesto_max,"zona":zona,"ocupacion":ocupacion,"excluir_id":excluir_id}.items() if v is not None}
    if ids is not None:
        try:
            parsed=[int(v) for v in ids.split(",")]
            if not 1<=len(parsed)<=100 or any(v<1 for v in parsed): raise ValueError()
        except ValueError:
            raise HTTPException(422,"Identificadores inválidos.") from None
        filters["ids"]=parsed
    users = service.repository.public_search(filters)
    return [{**user.public(), "foto_perfil": user.foto_perfil} if incluir_foto and ids is not None else user.public()
            for user in users]


class Notification(BaseModel):
    model_config=ConfigDict(extra="forbid")
    event_key: str=Field(pattern=r"^postulacion:[1-9][0-9]*:(Preseleccionada|Aceptada|Rechazada|Cancelada)$",max_length=150)
    id_usuario: int=Field(gt=0, le=MAX_ID)
    referencia_id: int=Field(gt=0, le=MAX_ID)
    estado: str=Field(pattern=r"^(Preseleccionada|Aceptada|Rechazada|Cancelada)$")


@router.post("/internal/v1/notificaciones")
def notify(data: Notification, request: Request, service=Depends(users)):
    expected=os.environ.get("ROOMIES_INTERNAL_TOKEN", "")
    supplied = request.headers.get("x-roomies-service", "")
    if len(expected)<32 or not expected.isascii() or not supplied.isascii() or not hmac.compare_digest(supplied,expected):
        raise HTTPException(403,"Servicio no autorizado.")
    if data.event_key != f"postulacion:{data.referencia_id}:{data.estado}":
        raise HTTPException(422,"Evento inconsistente.")
    persist_notification(service.repository, data.model_dump(), APPLICATION_TYPE)
    return {"success":True}


APPLICATION_STATES = {"Preseleccionada", "Aceptada", "Rechazada", "Cancelada"}
REPORT_STATES = {"En_Revision", "Resuelto", "Descartado"}
NotificationType = Literal["postulacion_resultado", "expulsion", "reporte_actualizado"]


class NotificationEvent(BaseModel):
    model_config = ConfigDict(extra="forbid")
    event_key: str = Field(min_length=1, max_length=150)
    tipo: NotificationType
    id_usuario: int = Field(strict=True, gt=0, le=MAX_ID)
    referencia_id: int = Field(strict=True, gt=0, le=MAX_ID)
    estado: str | None = Field(default=None, min_length=1, max_length=20)

    @model_validator(mode="after")
    def validate_event(self):
        if self.tipo == "postulacion_resultado":
            valid = self.estado in APPLICATION_STATES and self.event_key == f"postulacion:{self.referencia_id}:{self.estado}"
        elif self.tipo == "reporte_actualizado":
            valid = self.estado in REPORT_STATES and re.fullmatch(r"reporte_actualizado:[1-9][0-9]{0,18}", self.event_key)
        else:
            prefix, _, operation = self.event_key.partition(":")
            try:
                valid = self.estado in {None, "Expulsado"} and prefix == "expulsion" and str(UUID(operation)) == operation
            except ValueError:
                valid = False
        if not valid:
            raise ValueError("Evento inconsistente.")
        if self.tipo == "expulsion":
            self.estado = "Expulsado"
        return self


def persist_notification(repository, event, stored_type):
    if not repository.notify({**event, "tipo": stored_type}):
        raise HTTPException(409, "La clave del evento ya tiene otro contenido.")


@router.post("/internal/notificaciones")
def accept_notification(
    data: NotificationEvent,
    idempotency_key: Annotated[str, Header(max_length=150)],
    authorization: Annotated[str | None, Header()] = None,
    service=Depends(users),
):
    issuer, variable = PRODUCERS[data.tipo]
    verify_service_token(authorization, issuer, "auth-users", variable)
    if idempotency_key != data.event_key:
        raise HTTPException(422, "La clave debe coincidir con el evento.")
    stored_type = APPLICATION_TYPE if data.tipo == "postulacion_resultado" else data.tipo
    persist_notification(service.repository, data.model_dump(), stored_type)
    return {"success": True}


@router.get("/local/v1/notificaciones")
@router.get("/api/v1/notificaciones")
def notifications(who=Depends(identity),service=Depends(users)):
    return service.repository.notifications(service.own(who[0]).id_usuario)


class NotificationSummary(BaseModel):
    id_notificacion: int
    tipo: NotificationType
    referencia_id: int
    fecha: datetime


class NotificationsPage(BaseModel):
    items: list[NotificationSummary]
    siguiente_cursor: str | None


@router.get("/api/notificaciones", response_model=NotificationsPage)
def my_notifications(
    who=Depends(identity),
    service=Depends(users),
    limite: Annotated[int, Query(ge=1, le=100)] = 20,
    cursor: Annotated[str | None, Query(min_length=1, max_length=512)] = None,
):
    user = service.own(who[0])
    return notification_page(service.repository, user.id_usuario, limite, cursor)


@router.get("/internal/v1/resumen")
def summary(_=Depends(administrator),service=Depends(users)):
    return {"usuarios":service.repository.count()}
