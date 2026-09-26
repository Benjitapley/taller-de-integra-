from sqlalchemy import Column, Integer, DateTime, Enum
from sqlalchemy.ext.declarative import declarative_base
import enum
from datetime import datetime
from database import engine
from sqlalchemy import String, Float


Base = declarative_base()

Base.metadata.create_all(bind=engine)

# Enumerador extraído del MER
class EstadoConexion(enum.Enum):
    Pendiente = "Pendiente"
    Aceptada = "Aceptada"
    Rechazada = "Rechazada"

class Conexion(Base):
    __tablename__ = "conexion"

    id_conexion = Column(Integer, primary_key=True, index=True)
    
    # En un entorno de microservicios compartiendo BD, estos IDs corresponden a la tabla Usuario
    id_solicitante_FK = Column(Integer, nullable=False)
    id_receptor_FK = Column(Integer, nullable=False)
    
    estado = Column(Enum(EstadoConexion), default=EstadoConexion.Pendiente, nullable=False)
    fecha_solicitud = Column(DateTime, default=datetime.utcnow, nullable=False)


class Usuario(Base):
    __tablename__ = "usuario" # Asumimos que tu compa la llamó así
    # Solo mapeamos los campos que necesitas para buscar[cite: 7]
    id_usuario_PK = Column(Integer, primary_key=True, index=True)
    nombre = Column(String)
    presupuesto = Column(Integer)
    zona_interes = Column(String)
    ocupacion = Column(String)

class Publicacion(Base):
    __tablename__ = "publicacion"
    # Campos clave para los filtros de arriendo[cite: 7]
    id_publicacion_PK = Column(Integer, primary_key=True, index=True)
    titulo = Column(String)
    precio = Column(Float)
    ubicacion = Column(String)
    tipo = Column(String)
    estado = Column(String)