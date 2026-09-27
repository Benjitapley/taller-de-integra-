from sqlalchemy import Column, Integer, DateTime, Enum, String, Float
from sqlalchemy.ext.declarative import declarative_base
import enum
from datetime import datetime
from database import engine

Base = declarative_base()

Base.metadata.create_all(bind=engine)

class EstadoConexion(enum.Enum):
    Pendiente = "Pendiente"
    Aceptada = "Aceptada"
    Rechazada = "Rechazada"

class Conexion(Base):
    __tablename__ = "conexion"

    id_conexion = Column(Integer, primary_key=True, index=True)
    id_solicitante_FK = Column(Integer, nullable=False)
    id_receptor_FK = Column(Integer, nullable=False)
    estado = Column(Enum(EstadoConexion), default=EstadoConexion.Pendiente, nullable=False)
    fecha_solicitud = Column(DateTime, default=datetime.utcnow, nullable=False)


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