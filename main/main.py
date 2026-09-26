import os
from contextlib import asynccontextmanager
from io import BytesIO
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
FRONTEND = BASE / "CreacionDePublicacion"
IMAGENES = BASE / "imagenes"

IMAGENES.mkdir(parents=True, exist_ok=True)


# CONEXIÓN CON POSTGRESQL
def conectar():
    url = os.getenv("DATABASE_URL")

    if not url:
        raise RuntimeError("Falta configurar DATABASE_URL.")##########################################################

    return psycopg.connect(url, connect_timeout=10)


# CREAR TABLA AL INICIAR
@asynccontextmanager
async def lifespan(app: FastAPI):
    with conectar() as conexion:
        conexion.execute("""
            CREATE TABLE IF NOT EXISTS publicaciones (
                id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
                titulo VARCHAR(200) NOT NULL,
                categoria VARCHAR(20) NOT NULL
                    CHECK (categoria IN ('busco', 'ofrezco')),
                ubicacion VARCHAR(250) NOT NULL,
                precio BIGINT NOT NULL CHECK (precio >= 0),
                tipo_vivienda VARCHAR(30) NOT NULL
                    CHECK (
                        tipo_vivienda IN (
                            'casa',
                            'departamento',
                            'habitacion'
                        )
                    ),
                descripcion TEXT NOT NULL,
                permitir_comentarios BOOLEAN NOT NULL DEFAULT FALSE,
                imagen TEXT,
                creada_en TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
        """)

    yield


app = FastAPI(lifespan=lifespan)
app.include_router(conexion_router)
app.mount(
    "/static",
    StaticFiles(directory=FRONTEND),
    name="static"

)


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
    precio: Annotated[int, Form(ge=0, le=1000000000000)],
    tipo_vivienda: Annotated[
        Literal["casa", "departamento", "habitacion"],
        Form(),
    ],
    descripcion: Annotated[str, Form(min_length=1, max_length=5000)],
    permitir_comentarios: Annotated[bool, Form()] = False,
    imagen: Annotated[UploadFile | None, File()] = None,
):
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
        ruta_imagen.write_bytes(contenido)

    try:
        with conectar() as conexion:
            fila = conexion.execute(
                """
                INSERT INTO publicaciones (
                    titulo,
                    categoria,
                    ubicacion,
                    precio,
                    tipo_vivienda,
                    descripcion,
                    permitir_comentarios,
                    imagen
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id
                """,
                (
                    titulo,
                    categoria,
                    ubicacion,
                    precio,
                    tipo_vivienda,
                    descripcion,
                    permitir_comentarios,
                    nombre_imagen,
                ),
            ).fetchone()

            identificador = fila[0]

    except psycopg.Error:
        if ruta_imagen:
            ruta_imagen.unlink(missing_ok=True)

        raise HTTPException(
            status_code=500,
            detail="No se pudo guardar la publicación en PostgreSQL.",
        ) from None

    return {
        "id": identificador,
        "mensaje": "Publicación creada correctamente",
    }