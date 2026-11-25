"""Contrato final de cuenta/perfil; conserva los adaptadores de transición."""
from typing import Literal
from datetime import date
from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, ConfigDict, Field
from starlette.datastructures import UploadFile
import httpx

from app.api.routes.local_users import identity, users, OwnProfile, Initialization
from app.application.local_users import require_confirmed_email
from app.infrastructure.profile_images import ProfileImages, MAX_BYTES
from backend.service_runtime.contracts import DependencyUnavailable, RuleViolation
from backend.service_runtime.settings import service_url

router = APIRouter()


class ProfilePatch(BaseModel):
    model_config = ConfigDict(extra="forbid")
    ocupacion: Literal["Estudiante", "Trabajador", "Ambos"] | None = None
    genero: Literal["Hombre", "Mujer", "Otro", "Prefiero_no_indicarlo"] | None = None
    ciudad: str | None = Field(None, max_length=100)
    breve_descripcion: str | None = Field(None, max_length=160)
    sobre_mi: str | None = Field(None, max_length=2000)
    id_region_interes: int | None = Field(None, strict=True, gt=0, le=2147483647)
    id_comuna_interes: int | None = Field(None, strict=True, gt=0, le=2147483647)


class CanonicalProfile(OwnProfile):
    id_usuario: int
    fecha_nacimiento: date | None
    correo_verificado: bool
    genero: str | None = None
    id_region_interes: int | None = None
    id_comuna_interes: int | None = None
    calificacion_promedio: None = None
    total_evaluaciones: Literal[0] = 0


class PhotoResult(BaseModel):
    foto_perfil: str


def images():
    return ProfileImages()


def check_location(region, commune):
    if region is None and commune is None:
        return
    if region is None:
        raise RuleViolation("Selecciona la región de la comuna.", 422)
    try:
        base = service_url("LISTADO_UPSTREAM_URL", docker_hosts=("listado-applications",))
        with httpx.Client(timeout=5, trust_env=False, follow_redirects=False) as client:
            response = client.get(f"{base}/api/regiones/{region}/comunas")
        if response.status_code == 404:
            raise RuleViolation("Región no válida.", 422)
        response.raise_for_status()
        rows = response.json()
        if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
            raise ValueError()
        if commune is not None and not any(row.get("id_comuna") == commune and row.get("id_region") == region for row in rows):
            raise RuleViolation("La comuna no corresponde a la región.", 422)
    except RuleViolation:
        raise
    except Exception:
        raise DependencyUnavailable("No se pudo validar la ubicación.") from None


def render(service, who):
    user = service.own(who[0])
    return {**OwnProfile.from_user(user, who[1]).model_dump(), "id_usuario": user.id_usuario,
            "ocupacion": {"estudiante":"Estudiante","trabajador":"Trabajador","ambos":"Ambos"}.get((user.ocupacion or "").casefold()),
            "fecha_nacimiento": user.fecha_nacimiento, "calificacion_promedio": None, "total_evaluaciones": 0,
            **service.repository.profile_fields(who[0]), "correo_verificado": who[1]}


class InitialProfile(Initialization):
    nombre: str = Field(min_length=1,max_length=120)


@router.post("/api/usuarios/me",response_model=CanonicalProfile)
def initialize(data: InitialProfile, who=Depends(identity), service=Depends(users)):
    try:
        service.initialize(who[0], data.nombre, data.fecha_nacimiento, who[1])
    except RuleViolation as error:
        if error.status == 400:
            raise HTTPException(422, error.message) from None
        raise
    return render(service, who)


@router.get("/api/usuarios/me",response_model=CanonicalProfile)
def get_profile(who=Depends(identity), service=Depends(users)):
    return render(service, who)


@router.patch("/api/usuarios/me",response_model=CanonicalProfile)
def patch_profile(data: ProfilePatch, who=Depends(identity), service=Depends(users)):
    require_confirmed_email(who[1])
    changes = data.model_dump(exclude_unset=True)
    if not changes:
        raise HTTPException(422, "Envía al menos un campo editable.")
    if any(isinstance(value, str) and "\x00" in value for value in changes.values()):
        raise HTTPException(422, "Campo de perfil inválido.")
    service.own(who[0])
    current = service.repository.profile_fields(who[0])
    target = {**current, **changes}
    if {"id_region_interes", "id_comuna_interes"} & changes.keys():
        check_location(target.get("id_region_interes"), target.get("id_comuna_interes"))
    service.repository.patch_canonical(who[0], changes, current)
    return render(service, who)


@router.put("/api/usuarios/me/foto",response_model=PhotoResult)
async def replace_photo(request: Request, who=Depends(identity), service=Depends(users), storage=Depends(images)):
    require_confirmed_email(who[1])
    service.own(who[0])
    if request.headers.get("content-type", "").split(";", 1)[0].lower() != "multipart/form-data":
        raise HTTPException(415, "Envía una fotografía multipart.")
    async with request.form(max_files=1, max_fields=1, max_part_size=MAX_BYTES) as form:
        photo = form.get("foto")
        if list(form.keys()) != ["foto"] or len(form.getlist("foto")) != 1 or not isinstance(photo, UploadFile):
            raise HTTPException(422, "Envía solo un archivo foto.")
        reference = storage.upload(who[0], await photo.read(MAX_BYTES + 1), photo.content_type)
        try:
            service.repository.swap_photo(who[0], reference)
        except Exception:
            try:
                # Un fallo de confirmación SQL no autoriza borrar una foto ya referenciada.
                if service.own(who[0]).foto_perfil != reference:
                    storage.delete_new(reference)
            except Exception:
                pass  # La reconciliación posterior conserva el objeto ante resultado incierto.
            raise
    return {"foto_perfil": reference}
