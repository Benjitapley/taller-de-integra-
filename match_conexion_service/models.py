from sqlalchemy import Boolean, Column, DateTime, Enum, Float, ForeignKey, Integer, String
from sqlalchemy.ext.declarative import declarative_base
import enum
from datetime import datetime
from match_conexion_service.database import engine

Base = declarative_base()

class EstadoConexion(enum.Enum):
    Pendiente = "Pendiente"
    Aceptada = "Aceptada"
    Rechazada = "Rechazada"

class Conexion(Base):
    __tablename__ = "conexion"

    id_conexion = Column(Integer, primary_key=True, index=True)
    id_solicitante_FK = Column(Integer, nullable=False, index=True)
    id_receptor_FK = Column(Integer, nullable=False, index=True)
    estado = Column(Enum(EstadoConexion), default=EstadoConexion.Pendiente, nullable=False)
    fecha_solicitud = Column(DateTime, default=datetime.utcnow, nullable=False)
    verificada = Column(Boolean, default=False, nullable=False)


class Match(Base):
    __tablename__ = "match"

    id_match = Column(Integer, primary_key=True, index=True)
    id_conexion_FK = Column(Integer, ForeignKey("conexion.id_conexion"), unique=True, nullable=False)
    fecha_creacion = Column(DateTime, default=datetime.utcnow, nullable=False)


class Usuario(Base):
    __tablename__ = "usuario"
    id_usuario_PK = Column(Integer, primary_key=True, index=True)
    nombre = Column(String)
    presupuesto = Column(Integer)
    zona_interes = Column(String)
    ocupacion = Column(String)

class Publicacion(Base):
    __tablename__ = "publicacion"
    
    id_publicacion_PK = Column(Integer, primary_key=True, index=True)
    titulo = Column(String)
    precio = Column(Float)
    ubicacion = Column(String)
    tipo = Column(String)
    estado = Column(String)
    
    # Nuevos campos agregados para los filtros del frontend
    cupos_totales = Column(Integer)
    tipo_vivienda = Column(String)
    mascotas = Column(String)


def init_db() -> None:
    Base.metadata.create_all(bind=engine)