from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

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
    es_dueno: bool = False


class Member(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id_usuario: PositiveId
    fecha_ingreso: str
    fecha_salida: str | None = None
    es_responsable: bool


class MemberPage(BaseModel):
    model_config = ConfigDict(extra="forbid")
    items: list[Member]
    siguiente_cursor: str | None = None


class Expulsion(BaseModel):
    model_config = ConfigDict(extra="forbid")
    id_usuario: PositiveId
    motivo: Annotated[str, Field(min_length=1, max_length=500)]
    confirmo: Literal[True]


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
