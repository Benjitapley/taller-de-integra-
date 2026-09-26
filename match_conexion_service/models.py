from sqlalchemy import Column, Integer, DateTime, Enum
from sqlalchemy.orm import declarative_base
from datetime import datetime
import enum

Base = declarative_base()

# Definimos los estados exactos que pide la regla de negocio
class EstadoConexion(enum.Enum):
    PENDIENTE = "Pendiente"
    ACEPTADA = "Aceptada"
    RECHAZADA = "Rechazada"

class Conexion(Base):
    __tablename__ = "conexiones"

    id = Column(Integer, primary_key=True, index=True)
   #qien manda la solicitud
    usuario_origen_id = Column(Integer, nullable=False, index=True)
    #qien recibe la solicitud
    usuario_destino_id = Column(Integer, nullable=False, index=True)
    #el estado por defecto al enviar (FR-15 y FR-16)
    estado = Column(Enum(EstadoConexion), default=EstadoConexion.PENDIENTE)
    fecha_creacion = Column(DateTime, default=datetime.utcnow)