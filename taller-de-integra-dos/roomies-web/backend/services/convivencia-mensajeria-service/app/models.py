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
    estado: Literal['Activo', 'Finalizado'] = 'Activo'
    id_responsable: PositiveId | None = None
    puede_retirar: bool = False
    id_usuario_actual: PositiveId | None = None


class ExpulsionCreate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    id_usuario: PositiveId
    motivo: Annotated[str, Field(strict=True, min_length=1, max_length=500)]
    confirmo: Annotated[bool, Field(strict=True)]

    @field_validator('motivo')
    @classmethod
    def reason(cls, value):
        if not value.strip() or '\0' in value:
            raise ValueError('Escribe un motivo.')
        return value.strip()

    @field_validator('confirmo')
    @classmethod
    def confirmed(cls, value):
        if value is not True:
            raise ValueError('Confirma el retiro.')
        return value


class TaskAssignment(BaseModel):
    model_config = ConfigDict(extra='forbid')
    id_asignado: PositiveId | None


class TaskCreate(BaseModel):
    model_config = ConfigDict(extra='forbid')
    titulo: Annotated[str, Field(strict=True, min_length=1, max_length=120)]
    descripcion: Annotated[str, Field(strict=True, max_length=1000)] | None = None
    id_asignado: PositiveId | None = None

    @field_validator('descripcion')
    @classmethod
    def description(cls, value):
        if value is not None and '\0' in value:
            raise ValueError('Descripción inválida.')
        return value

    @field_validator('titulo')
    @classmethod
    def title(cls, value):
        if not value.strip() or '\0' in value:
            raise ValueError('Escribe un título.')
        return value.strip()


class TaskState(BaseModel):
    model_config = ConfigDict(extra='forbid')
    estado: Literal['Completada']


class ExpulsionResult(Rental):
    id_usuario_retirado: PositiveId
    sincronizacion_pendiente: bool


class Task(BaseModel):
    model_config = ConfigDict(extra='forbid')
    id_tarea: PositiveId
    id_arriendo: PositiveId
    titulo: str
    descripcion: str | None
    estado: Literal['Pendiente', 'Completada']
    id_creador: PositiveId
    id_asignado: PositiveId | None
    fecha_creacion: datetime


class TaskPage(BaseModel):
    items: list[Task]
    siguiente_cursor: str | None


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
    id_cliente: UUID | None = None


class MessagePage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: list[Message]
    siguiente_cursor: str | None


class ErrorResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")
    detail: str
    code: str


class ServiceError(Exception):
    def __init__(self, code, detail, status=409):
        self.status = status
        self.body = {"detail": detail, "code": code}
        super().__init__(detail)


def unavailable():
    return ServiceError("DEPENDENCY_UNAVAILABLE", "Dependencia no disponible; reintenta con la misma clave.", 503)
