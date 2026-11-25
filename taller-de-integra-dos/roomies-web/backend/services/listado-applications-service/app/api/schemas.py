"""DTO público y descripción del multipart consumido por web/Expo."""
from datetime import datetime
from typing import Literal
from pydantic import BaseModel, Field


class PublicationImage(BaseModel):
    id_imagen:int
    url:str
    orden:int


class PublicationLocation(BaseModel):
    id: int
    nombre: str


class PublicationAuthor(BaseModel):
    id_usuario: int
    nombre: str
    foto: str | None


class PublicationApplication(BaseModel):
    id_postulacion: int
    estado: str


class Publication(BaseModel):
    id_publicacion:int
    id:int=Field(deprecated=True,description="Alias temporal de id_publicacion.")
    titulo:str
    tipo:Literal["Arrendador","Compartida"]
    tipo_vivienda:Literal["casa","departamento","habitacion"]
    descripcion:str
    precio:int=Field(ge=0,le=999999999999)
    ubicacion:str
    estado:Literal["Disponible","Activa","Cerrada"]
    cupos_totales:int
    cupos:int=Field(deprecated=True,description="Alias de capacidad total; no es disponibilidad.")
    cupos_disponibles:int|None
    categoria:Literal["busco","ofrezco"]
    mascota:Literal["si","no"]
    permitir_comentarios:bool
    imagen:str|None
    imagenes:list[PublicationImage]
    fecha_publicacion:datetime
    id_region:int|None=Field(description="CUT de región; null solo en datos heredados pendientes de conciliación.")
    id_comuna:int|None
    reglas:list[str] = Field(deprecated=True, description="Alias de transición; el detalle también expone reglas_arrendador.")
    region: PublicationLocation | None
    comuna: PublicationLocation | None
    autor: PublicationAuthor | None


class OwnedPublication(Publication):
    id_arriendo: int | None


class PublicationDetail(Publication):
    reglas_arrendador: list[str]
    mi_postulacion: PublicationApplication | None = None
    id_arriendo: int | None = None
    id_propietario: int | None = Field(
        default=None, description="ID del propietario, presente con una sesión activa y correo confirmado."
    )


class PublicationSaved(Publication):
    mensaje:str


class PublicationPage(BaseModel):
    items:list[Publication]
    siguiente_cursor:str|None


class OwnedPublicationPage(PublicationPage):
    items: list[OwnedPublication]


class Region(BaseModel):
    id_region:int
    nombre:str


class Commune(BaseModel):
    id_comuna:int
    id_region:int
    nombre:str


MULTIPART={
    "parameters":[{"in":"header","name":"Idempotency-Key","required":False,
                   "description":"UUID estable por intento lógico; reutilizar en reintentos. Otro cuerpo con la misma clave devuelve 409.",
                   "schema":{"type":"string","format":"uuid"}}],
    "requestBody":{"required":True,"content":{"multipart/form-data":{"schema":{
        "type":"object",
        "required":["titulo","descripcion","precio","tipo","tipo_vivienda","cupos_totales","id_region","id_comuna"],
        "properties":{
            "titulo":{"type":"string","minLength":1,"maxLength":200},
            "descripcion":{"type":"string","minLength":1,"maxLength":5000},
            "ubicacion":{"type":"string","minLength":1,"maxLength":250,"deprecated":True,"description":"Texto de ubicación de clientes existentes. Si se omite se deriva del catálogo."},
            "precio":{"type":"integer","minimum":0,"maximum":999999999999,"description":"Pesos enteros CLP; se valida antes de guardar."},
            "tipo":{"type":"string","enum":["Arrendador"]},
            "categoria":{"type":"string","enum":["ofrezco"],"default":"ofrezco","deprecated":True},
            "tipo_vivienda":{"type":"string","enum":["casa","departamento","habitacion"]},
            "mascota":{"type":"string","enum":["si","no"],"default":"no"},
            "cupos_totales":{"type":"integer","minimum":1,"maximum":2147483647},
            "id_region":{"type":"integer","minimum":1},"id_comuna":{"type":"integer","minimum":1},
            "reglas_arrendador":{"type":"string","description":"Lista JSON de hasta 20 reglas textuales, 1-300 caracteres por regla."},
            "reglas":{"type":"string","deprecated":True,"description":"Alias de transición. No se admite junto con reglas_arrendador."},
            "permitir_comentarios":{"type":"boolean","default":False,"deprecated":True},
            "imagenes":{"type":"array","maxItems":5,"items":{"type":"string","format":"binary"},"description":"JPEG/PNG/WebP; máximo 5 000 000 bytes y 20 megapíxeles decodificados cada archivo. Hasta 5 imágenes totales al sumar conservadas."},
            "imagenes_conservar":{"type":"string","description":"Solo edición: lista JSON de IDs propios, en el orden deseado. Omitir conserva las vigentes; [] las quita."}
        }
    }}}}
}
