from pydantic import BaseModel
from datetime import datetime
from enum import Enum
from typing import Optional
from typing import Optional

# Replicamos el enumerador del MER para que Pydantic valide los textos exactos
class EstadoConexion(str, Enum):
    Pendiente = "Pendiente"
    Aceptada = "Aceptada"
    Rechazada = "Rechazada"

# Esquema base con los datos obligatorios que siempre se repiten
class ConexionBase(BaseModel):
    id_solicitante_FK: int
    id_receptor_FK: int

# Esquema para cuando un usuario CREA una nueva solicitud (POST)
class ConexionCreate(ConexionBase):
    pass # Solo necesita quién la envía y quién la recibe, el resto es automático

# Esquema para cuando un usuario ACTUALIZA la solicitud (ej: Aceptar o Rechazar)
class ConexionUpdate(BaseModel):
    estado: EstadoConexion

# Esquema para la RESPUESTA que entregará la API al frontend
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

# Esquema para devolver los resultados de arriendos
class PublicacionBusqueda(BaseModel):
    id_publicacion_PK: int
    titulo: str
    precio: float
    ubicacion: str
    tipo: str

    class Config:
        from_attributes = True

   