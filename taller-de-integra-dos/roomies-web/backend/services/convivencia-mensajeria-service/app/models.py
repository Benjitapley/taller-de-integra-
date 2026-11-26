from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

PositiveId = Annotated[int, Field(strict=True, gt=0, le=9223372036854775807)]


class Incorporation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id_postulacion: PositiveId
    id_publicacion: PositiveId
    id_usuario: PositiveId
    version_capacidad: PositiveId


class Reservation(Incorporation):
    id_reserva: UUID
    cupos_totales: PositiveId


class OccupancyConfirmation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id_arriendo: PositiveId
    ocupacion: Annotated[int, Field(strict=True, ge=0, le=9223372036854775807)]
    version_ocupacion: PositiveId


class Receipt(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id_incorporacion: UUID
    id_arriendo: PositiveId
    id_publicacion: PositiveId
    id_usuario: PositiveId
    estado: Literal["Activa"]
    confirmacion_publicacion: Literal["Pendiente"]


class Rental(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id_arriendo: PositiveId
    id_publicacion: PositiveId
    cupos_totales: PositiveId
    version_capacidad: PositiveId
    ocupacion: Annotated[int, Field(strict=True, ge=0)]


class MessageCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    contenido: Annotated[str, Field(strict=True, min_length=1, max_length=2000)]
    id_cliente: UUID

    @field_validator("contenido")
    @classmethod
    def non_blank(cls, value: str):
        if not value.strip():
            raise ValueError("El mensaje no puede estar vacío.")
        return value


class Expulsion(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id_usuario: PositiveId
    motivo: Annotated[str, Field(strict=True, min_length=1, max_length=500)]
    confirmacion: Annotated[bool, Field(strict=True)]

    @field_validator("motivo")
    @classmethod
    def non_blank_reason(cls, value):
        if not value.strip():
            raise ValueError("El motivo no puede estar vacío.")
        return value

    @field_validator("confirmacion")
    @classmethod
    def confirmed(cls, value):
        if value is not True:
            raise ValueError("Se requiere confirmación explícita.")
        return value


class Conversation(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id_conversacion: PositiveId
    id_arriendo: PositiveId
    fecha_creacion: datetime


class Message(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id_mensaje: PositiveId
    id_conversacion: PositiveId
    id_remitente: PositiveId
    nombre_remitente: str
    contenido: Annotated[str, Field(min_length=1, max_length=2000)]
    fecha_envio: datetime
    id_cliente: UUID | None = Field(default=None, exclude_if=lambda value: value is None)


class MessagePage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: list[Message]
    siguiente_cursor: str | None


class ErrorResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    detail: str
    code: str
    codigo: str | None = None


class ServiceError(Exception):
    def __init__(self, code, detail, status=409):
        self.status = status
        self.body = {"detail": detail, "code": code}
        if status == 403:
            self.body["codigo"] = "sin_permiso"
        super().__init__(detail)


def unavailable():
    return ServiceError("DEPENDENCY_UNAVAILABLE", "Dependencia no disponible; reintenta con la misma clave.", 503)
