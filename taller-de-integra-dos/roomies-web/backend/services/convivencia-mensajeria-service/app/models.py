from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from pydantic import AliasChoices, BaseModel, ConfigDict, Field, field_validator

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
    id_responsable: PositiveId | None = None
    estado: Literal["Activo", "Finalizado"] = "Activo"
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


class Expulsion(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id_usuario: PositiveId
    motivo: Annotated[str, Field(strict=True, min_length=1, max_length=500)]
    confirmo: Annotated[bool, Field(strict=True, validation_alias=AliasChoices("confirmo", "confirmacion"))]

    @field_validator("motivo")
    @classmethod
    def reason(cls, value):
        if not value.strip():
            raise ValueError("Indica un motivo.")
        return value.strip()

    @field_validator("confirmo")
    @classmethod
    def confirmation(cls, value):
        if value is not True:
            raise ValueError("Confirma el retiro.")
        return value


class TaskCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    titulo: Annotated[str, Field(strict=True, min_length=1, max_length=120)]
    descripcion: Annotated[str, Field(strict=True, max_length=1000)] | None = None
    id_asignado: PositiveId | None = None

    @field_validator("titulo")
    @classmethod
    def title(cls, value):
        if not value.strip():
            raise ValueError("Indica un título.")
        return value.strip()


class TaskAssign(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id_asignado: PositiveId | None


class TaskComplete(BaseModel):
    model_config = ConfigDict(extra="forbid")
    estado: Literal["Completada"]
