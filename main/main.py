import os
from contextlib import asynccontextmanager
from io import BytesIO
from decimal import Decimal
import logging
from pathlib import Path
from typing import Annotated, Literal
from uuid import uuid4

import httpx
import psycopg
from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile
from match_conexion_service.routes import router as conexion_router

from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from PIL import Image, UnidentifiedImageError


# CARPETAS
BASE = Path(__file__).resolve().parent
FRONTEND = BASE / "CreacionDePublicvacion"
IMAGENES = BASE / "imagenes"

IMAGENES.mkdir(parents=True, exist_ok=True)


# CONEXIÓN CON POSTGRESQL
def conectar():
    url = os.getenv("DATABASE_URL")

    if not url:
        raise RuntimeError("Falta configurar DATABASE_URL.")##########################################################

    return psycopg.connect(url, connect_timeout=10)


# Verifica el esquema existente. No crea la tabla antigua.
@asynccontextmanager
async def lifespan(app: FastAPI):
    with conectar() as conexion:
        conexion.execute("""
            SELECT id_publicacion, id_usuario, tipo, titulo, descripcion,
                   precio, ubicacion, estado, cupos_totales,
                   categoria, tipo_vivienda, permitir_comentarios
            FROM haycupo.publicacion LIMIT 0
        """)
        conexion.execute("SELECT id_imagen, id_publicacion, url, orden FROM haycupo.imagen_publicacion LIMIT 0")
    yield


app = FastAPI(lifespan=lifespan)
app.include_router(conexion_router)
app.mount(
    "/static",
    StaticFiles(directory=FRONTEND),
    name="static"

)


app.mount("/imagenes", StaticFiles(directory=IMAGENES), name="imagenes")


# Autor fijo SOLO para desarrollo local sin sistema de login.
# No se recibe un id arbitrario desde el navegador.
def autor_de_prueba():
    if os.getenv("MODO_PRUEBA_LOCAL") != "1":
        raise HTTPException(503, "Falta integrar el login. Para pruebas locales configura MODO_PRUEBA_LOCAL=1.")
    try:
        identificador = int(os.environ["PUBLICACION_AUTOR_ID"])
        if identificador <= 0:
            raise ValueError()
        return identificador
    except (KeyError, ValueError):
        raise HTTPException(503, "Configura PUBLICACION_AUTOR_ID con el ID del usuario de prueba.") from None


# MOSTRAR EL HTML
@app.get("/")
def mostrar_formulario():
    return FileResponse(FRONTEND / "Creacion.html")


# AUTOCOMPLETADO DE UBICACIÓN
@app.get("/api/ubicaciones")
async def buscar_ubicaciones(
    texto: str = Query(min_length=3, max_length=250),
):
    clave = os.getenv("GEOAPIFY_API_KEY")

    if not clave:
        raise HTTPException(
            status_code=503,
            detail="Falta configurar la clave de Geoapify.",
        )

    if len(texto.strip()) < 3:
        return []

    parametros = {
        "text": texto.strip(),
        "apiKey": clave,
        "lang": "es",
        "limit": 5,
        "format": "json",
    }

    try:
        async with httpx.AsyncClient(timeout=10) as cliente:
            respuesta = await cliente.get(
                "https://api.geoapify.com/v1/geocode/autocomplete",
                params=parametros,
            )
            respuesta.raise_for_status()
            datos = respuesta.json()

    except (httpx.HTTPError, ValueError):
        raise HTTPException(
            status_code=502,
            detail="No se pudo consultar el servicio de ubicaciones.",
        ) from None

    return [
        lugar["formatted"]
        for lugar in datos.get("results", [])
        if lugar.get("formatted")
    ]


# CREAR PUBLICACIÓN
@app.post("/api/publicaciones", status_code=201)
def crear_publicacion(
    titulo: Annotated[str, Form(min_length=1, max_length=200)],
    categoria: Annotated[Literal["busco", "ofrezco"], Form()],
    ubicacion: Annotated[str, Form(min_length=1, max_length=250)],
    precio: Annotated[Decimal, Form(ge=0, max_digits=14, decimal_places=2)],
    tipo: Annotated[Literal["Arrendador", "Compartida"], Form()],
    cupos_totales: Annotated[int, Form(ge=1, le=2147483647)],
    tipo_vivienda: Annotated[
        Literal["casa", "departamento", "habitacion"],
        Form(),
    ],
    descripcion: Annotated[str, Form(min_length=1, max_length=5000)],
    permitir_comentarios: Annotated[bool, Form()] = False,
    imagen: Annotated[UploadFile | None, File()] = None,
):
    id_usuario = autor_de_prueba()
    titulo = titulo.strip()
    ubicacion = ubicacion.strip()
    descripcion = descripcion.strip()

    if not all([titulo, ubicacion, descripcion]):
        raise HTTPException(
            status_code=422,
            detail="Completa el título, la ubicación y la descripción.",
        )

    nombre_imagen = None
    ruta_imagen = None

    if imagen and imagen.filename:
        limite = 5 * 1024 * 1024
        contenido = imagen.file.read(limite + 1)

        if len(contenido) > limite:
            raise HTTPException(
                status_code=413,
                detail="La imagen debe pesar como máximo 5 MB.",
            )

        try:
            with Image.open(BytesIO(contenido)) as foto:
                extensiones = {
                    "JPEG": ".jpg",
                    "PNG": ".png",
                    "WEBP": ".webp",
                }

                extension = extensiones.get(foto.format)

                if not extension:
                    raise HTTPException(
                        status_code=422,
                        detail="Usa una imagen JPG, PNG o WEBP.",
                    )

                foto.verify()

        except (
            UnidentifiedImageError,
            OSError,
            ValueError,
            Image.DecompressionBombError,
        ):
            raise HTTPException(
                status_code=422,
                detail="El archivo no es una imagen válida.",
            ) from None

        nombre_imagen = uuid4().hex + extension
        ruta_imagen = IMAGENES / nombre_imagen


    try:
        with conectar() as conexion:
            existe = conexion.execute(
                "SELECT id_usuario FROM haycupo.usuario WHERE id_usuario = %s FOR KEY SHARE",
                (id_usuario,),
            ).fetchone()
            if not existe:
                raise HTTPException(422, "El autor configurado no existe. Revisa PUBLICACION_AUTOR_ID.")

            fila = conexion.execute(
                """
                INSERT INTO haycupo.publicacion (
                    id_usuario, tipo, titulo, descripcion, precio, ubicacion,
                    estado, cupos_totales, categoria, tipo_vivienda,
                    permitir_comentarios
                )
                VALUES (%s, %s, %s, %s, %s, %s, 'Disponible', %s, %s, %s, %s)
                RETURNING id_publicacion
                """,
                (id_usuario, tipo, titulo, descripcion, precio, ubicacion,
                 cupos_totales, categoria, tipo_vivienda, permitir_comentarios),
            ).fetchone()
            identificador = fila[0]

            if ruta_imagen:
                ruta_imagen.write_bytes(contenido)
                conexion.execute(
                    """INSERT INTO haycupo.imagen_publicacion
                       (id_publicacion, url, orden) VALUES (%s, %s, 0)""",
                    (identificador, f"/imagenes/{nombre_imagen}"),
                )
            # El contexto confirma ambas inserciones juntas al salir.

    except (psycopg.Error, OSError):
        if ruta_imagen:
            try:
                ruta_imagen.unlink(missing_ok=True)
            except OSError:
                logging.getLogger(__name__).warning("No se pudo limpiar la foto del intento fallido.")
        # No imprimir claves ni datos enviados en los registros.
        logging.getLogger(__name__).error("Falló el guardado de la publicación. Revisa PostgreSQL y los permisos de imagenes.")
        raise HTTPException(
            status_code=500,
            detail="No se pudo guardar la publicación. Revisa la conexión y el esquema de PostgreSQL.",
        ) from None

    return {
        "id": identificador,
        "mensaje": "Publicación creada correctamente",
    }
