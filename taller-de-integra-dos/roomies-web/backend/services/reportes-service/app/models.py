from datetime import datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, field_validator, model_validator

MAX_ID = 9223372036854775807
BusinessId = Annotated[int, Field(strict=True, gt=0, le=MAX_ID)]
ReportType = Literal["Usuario", "Publicacion"]
ReportStatus = Literal["Pendiente", "En_Revision", "Resuelto", "Descartado"]


class ReportInput(BaseModel):
    model_config = ConfigDict(extra="forbid")

    categoria: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=80)]
    descripcion: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)]
    id_usuario_reportado: BusinessId | None = None
    id_publicacion_reportada: BusinessId | None = None

    @field_validator("categoria", "descripcion")
    @classmethod
    def reject_null_byte(cls, value: str) -> str:
        if "\x00" in value:
            raise ValueError("Texto inválido.")
        return value

    @model_validator(mode="after")
    def require_one_target(self):
        if (self.id_usuario_reportado is None) == (self.id_publicacion_reportada is None):
            raise ValueError("Indica exactamente un usuario o una publicación.")
        return self


class Report(BaseModel):
    id_reporte: int
    tipo: ReportType
    id_usuario_reportado: int | None
    id_publicacion_reportada: int | None
    categoria: str
    descripcion: str
    estado: ReportStatus
    fecha: datetime


class ReportPage(BaseModel):
    items: list[Report]
    siguiente_cursor: str | None


class ReviewInput(BaseModel):
    model_config = ConfigDict(extra="forbid")
    estado: ReportStatus
    nota_interna: Annotated[str, StringConstraints(strip_whitespace=True, min_length=1, max_length=1000)] | None = None

    @field_validator("nota_interna")
    @classmethod
    def reject_null_byte(cls, value):
        if value is not None and "\x00" in value:
            raise ValueError("Nota inválida.")
        return value


class AdminReport(Report):
    id_denunciante: int


class AdminReportPage(BaseModel):
    items: list[AdminReport]
    siguiente_cursor: str | None


class ReviewEntry(BaseModel):
    id_actuacion: int
    id_administrador: int
    estado_anterior: ReportStatus
    estado_nuevo: ReportStatus
    nota_interna: str | None
    fecha: datetime


class AdminReportDetail(AdminReport):
    historial: list[ReviewEntry]
