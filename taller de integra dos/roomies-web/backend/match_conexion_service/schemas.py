from pydantic import BaseModel, Field
from datetime import datetime
from enum import Enum
from typing import Optional

class EstadoConexion(str, Enum):
    Pendiente = "Pendiente"
    Aceptada = "Aceptada"
    Rechazada = "Rechazada"

class ConexionBase(BaseModel):
    id_solicitante_FK: int
    id_receptor_FK: int

class ConexionCreate(ConexionBase):
    id_solicitante_FK: int | None = Field(default=None, ge=1)
    id_receptor_FK: int = Field(ge=1)

class ConexionUpdate(BaseModel):
    estado: EstadoConexion

class ConexionResponse(ConexionBase):
    id_conexion: int
    estado: EstadoConexion
    fecha_solicitud: datetime

    class Config:
        from_attributes = True

class UsuarioBusqueda(BaseModel):
    id_usuario_PK: int
    nombre: str
    presupuesto: Optional[int]
    zona_interes: Optional[str]
    ocupacion: Optional[str]

    class Config:
        from_attributes = True

class PublicacionBusqueda(BaseModel):
    id_publicacion_PK: int
    titulo: str
    precio: float
    ubicacion: str
    tipo: str
    
    # Reflejamos los nuevos campos aquí también
    cupos_totales: Optional[int]
    tipo_vivienda: Optional[str]
    mascotas: Optional[str]

    class Config:
        from_attributes = True
