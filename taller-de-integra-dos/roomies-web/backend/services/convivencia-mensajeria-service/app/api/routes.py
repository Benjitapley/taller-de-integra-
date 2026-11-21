import hmac
import os
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from pydantic import BaseModel, ConfigDict, Field

from app.api.cursor import (
    decode as decode_cursor,
    decode_conversations,
    decode_members,
    encode as encode_cursor,
    encode_conversations,
    encode_members,
)
from app.application.service import Convivencia
from app.infrastructure.clients import HttpListingCapacity
from app.infrastructure.repository import PostgresConvivencia
from backend.service_runtime.security import confirmed_actor

router = APIRouter()


def service():
    return Convivencia(PostgresConvivencia(), HttpListingCapacity())


def internal_authorized(request: Request):
    expected = os.environ.get("ROOMIES_INTERNAL_TOKEN", "")
    supplied = request.headers.get("x-roomies-service", "")
    if len(expected) < 32 or not hmac.compare_digest(supplied, expected):
        raise HTTPException(403, "Servicio no autorizado.")


class Admission(BaseModel):
    model_config = ConfigDict(extra="forbid")
    event_key: str = Field(pattern=r"^postulacion:[1-9][0-9]*:Aceptada$", max_length=100)
    id_postulacion: int = Field(gt=0, strict=True)
    id_publicacion: int = Field(gt=0, strict=True)
    id_usuario: int = Field(gt=0, strict=True)


@router.post("/internal/incorporaciones")
def incorporate(data: Admission, request: Request, app=Depends(service)):
    internal_authorized(request)
    return app.incorporate(
        data.event_key,
        data.id_publicacion,
        data.id_postulacion,
        data.id_usuario,
    )


@router.get("/internal/pertenencias/{rental_id}")
def internal_members(rental_id: int, request: Request, app=Depends(service)):
    internal_authorized(request)
    return app.internal_members(rental_id)


@router.get("/internal/relaciones")
def internal_relation(
    request: Request,
    user_a: int = Query(gt=0),
    user_b: int = Query(gt=0),
    app=Depends(service),
):
    internal_authorized(request)
    return {"relacion_previa": app.historical_relation(user_a, user_b)}


@router.get("/api/arriendos/mio")
def my_rental(identity=Depends(confirmed_actor), app=Depends(service)):
    return app.my_rental(identity.user_id)


@router.get("/api/arriendos/{rental_id}")
def rental(rental_id: int, identity=Depends(confirmed_actor), app=Depends(service)):
    return app.rental(rental_id, identity.user_id)


@router.get("/api/arriendos/{rental_id}/integrantes")
def members(
    rental_id: int,
    identity=Depends(confirmed_actor),
    limite: Annotated[int, Query(ge=1, le=100)] = 20,
    antes: Annotated[str | None, Query(max_length=2048)] = None,
    app=Depends(service),
):
    cursor = (
        decode_members(antes, rental_id, identity.user_id)
        if antes is not None
        else None
    )
    rental, rows = app.members(
        rental_id, identity.user_id, cursor, limite + 1
    )
    has_more = len(rows) > limite
    items = rows[:limite]
    return {
        "items": items,
        "cupos_ocupados": rental["cupos_ocupados"],
        "cupos_totales": rental["capacidad"],
        "siguiente_cursor": (
            encode_members(rental_id, identity.user_id, items[-1])
            if has_more
            else None
        ),
    }


class Removal(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id_usuario: int = Field(gt=0, strict=True)
    motivo: str = Field(min_length=1, max_length=1000)
    confirmar: bool = Field(strict=True)
    idempotency_key: str = Field(
        min_length=1, max_length=120, pattern=r"^[A-Za-z0-9._:-]+$"
    )


@router.post("/api/arriendos/{rental_id}/expulsiones")
def expel(
    rental_id: int,
    data: Removal,
    identity=Depends(confirmed_actor),
    app=Depends(service),
):
    return app.expel(
        rental_id,
        identity.user_id,
        data.id_usuario,
        data.idempotency_key,
        data.motivo,
        data.confirmar,
    )


@router.get("/api/conversaciones")
def conversations(
    identity=Depends(confirmed_actor),
    limite: Annotated[int, Query(ge=1, le=100)] = 20,
    antes: Annotated[str | None, Query(max_length=2048)] = None,
    app=Depends(service),
):
    cursor = (
        decode_conversations(antes, identity.user_id)
        if antes is not None
        else None
    )
    rows = app.conversations(identity.user_id, cursor, limite + 1)
    has_more = len(rows) > limite
    items = rows[:limite]
    return {
        "items": items,
        "siguiente_cursor": (
            encode_conversations(identity.user_id, items[-1])
            if has_more
            else None
        ),
    }


@router.get("/api/conversaciones/{conversation_id}")
def conversation(
    conversation_id: int,
    identity=Depends(confirmed_actor),
    app=Depends(service),
):
    return app.conversation(conversation_id, identity.user_id)


@router.get("/api/conversaciones/{conversation_id}/mensajes")
def messages(
    conversation_id: int,
    identity=Depends(confirmed_actor),
    limite: Annotated[int, Query(ge=1, le=100)] = 20,
    antes: Annotated[str | None, Query(max_length=2048)] = None,
    app=Depends(service),
):
    cursor = (
        decode_cursor(antes, conversation_id, identity.user_id)
        if antes is not None
        else None
    )
    rows = app.messages(conversation_id, identity.user_id, cursor, limite + 1)
    has_more = len(rows) > limite
    items = rows[:limite]
    next_cursor = (
        encode_cursor(conversation_id, identity.user_id, items[-1])
        if has_more
        else None
    )
    return {"items": items, "siguiente_cursor": next_cursor}


class NewMessage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id_cliente: UUID
    contenido: str = Field(min_length=1, max_length=2000)


@router.post("/api/conversaciones/{conversation_id}/mensajes", status_code=201)
def send_message(
    conversation_id: int,
    data: NewMessage,
    identity=Depends(confirmed_actor),
    app=Depends(service),
):
    return app.send_message(
        conversation_id,
        identity.user_id,
        str(data.id_cliente),
        data.contenido,
    )
