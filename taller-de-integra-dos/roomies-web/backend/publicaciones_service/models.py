from sqlalchemy import (
    Boolean,
    Column,
    ForeignKey,
    Integer,
    Numeric,
    String,
    Text,
)
from sqlalchemy.dialects.postgresql import ARRAY
from sqlalchemy.orm import DeclarativeBase, relationship


class Base(DeclarativeBase):
    pass


class Publicacion(Base):
    __tablename__ = "publicacion"
    __table_args__ = {"schema": "haycupo"}

    id_publicacion = Column(Integer, primary_key=True)
    id_usuario = Column(Integer, nullable=False)
    titulo = Column(String(200), nullable=False)
    descripcion = Column(Text, nullable=False)
    precio = Column(Numeric(14, 2), nullable=False)
    ubicacion = Column(String(250), nullable=False)

    # Valores usados por el formulario actual.
    categoria = Column(String, nullable=False)  # busco / ofrezco
    tipo = Column(String, nullable=False)  # Arrendador / Compartida
    tipo_vivienda = Column(String, nullable=False)  # casa / departamento / habitacion

    estado = Column(String, nullable=False, default="Disponible")
    cupos_totales = Column(Integer, nullable=False)
    mascota = Column(String, nullable=False, default="no")
    tipos_mascotas_aceptadas = Column(
        ARRAY(String(40)),
        nullable=False,
        default=list,
    )
    condiciones_mascotas = Column(Text, nullable=True)
    permitir_comentarios = Column(Boolean, nullable=False, default=False)

    # Se conserva porque la API actual también utiliza esta columna.
    contenido = Column(Text, nullable=True)

    imagenes = relationship(
        "ImagenPublicacion",
        back_populates="publicacion",
        order_by="ImagenPublicacion.orden",
    )


class ImagenPublicacion(Base):
    __tablename__ = "imagen_publicacion"
    __table_args__ = {"schema": "haycupo"}

    id_imagen = Column(Integer, primary_key=True)
    id_publicacion = Column(
        Integer,
        ForeignKey("haycupo.publicacion.id_publicacion"),
        nullable=False,
    )
    url = Column(String, nullable=False)
    orden = Column(Integer, nullable=False, default=0)

    publicacion = relationship(
        "Publicacion",
        back_populates="imagenes",
    )
