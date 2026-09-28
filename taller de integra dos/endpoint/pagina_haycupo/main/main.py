import os
import logging

from contextlib import asynccontextmanager
from io import BytesIO
from decimal import Decimal
from pathlib import Path
from typing import Annotated, Literal
from uuid import uuid4

import httpx
import psycopg

from fastapi import (
    FastAPI,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
)

from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

from PIL import Image, UnidentifiedImageError


# =========================================================
# CARPETAS
# =========================================================

BASE = Path(__file__).resolve().parent

FRONTEND = BASE / "CreacionDePublicvacion"

IMAGENES = BASE / "imagenes"

IMAGENES.mkdir(
    parents=True,
    exist_ok=True
)


# =========================================================
# CONEXIÓN POSTGRESQL
# =========================================================

def conectar():

    url = os.getenv("DATABASE_URL")

    if not url:
        raise RuntimeError(
            "Falta configurar DATABASE_URL."
        )

    return psycopg.connect(
        url,
        connect_timeout=10
    )


# =========================================================
# VERIFICAR ESQUEMA AL INICIAR
# =========================================================

@asynccontextmanager
async def lifespan(app: FastAPI):

    with conectar() as conexion:

        conexion.execute(
            """
            SELECT
                id_publicacion,
                id_usuario,
                tipo,
                titulo,
                descripcion,
                precio,
                ubicacion,
                estado,
                cupos_totales,
                categoria,
                tipo_vivienda,
                permitir_comentarios

            FROM haycupo.publicacion

            LIMIT 0
            """
        )

        conexion.execute(
            """
            SELECT
                id_imagen,
                id_publicacion,
                url,
                orden

            FROM haycupo.imagen_publicacion

            LIMIT 0
            """
        )

    yield


# =========================================================
# FASTAPI
# =========================================================

app = FastAPI(
    lifespan=lifespan
)


# =========================================================
# ARCHIVOS ESTÁTICOS
# =========================================================

app.mount(
    "/static",
    StaticFiles(
        directory=FRONTEND
    ),
    name="static",
)

app.mount(
    "/imagenes",
    StaticFiles(
        directory=IMAGENES
    ),
    name="imagenes",
)


# =========================================================
# USUARIO DE PRUEBA
# =========================================================

def autor_de_prueba():

    if os.getenv("MODO_PRUEBA_LOCAL") != "1":

        raise HTTPException(
            status_code=503,
            detail=(
                "Falta integrar el login. "
                "Para pruebas locales configura "
                "MODO_PRUEBA_LOCAL=1."
            ),
        )

    try:

        identificador = int(
            os.environ["PUBLICACION_AUTOR_ID"]
        )

        if identificador <= 0:
            raise ValueError()

        return identificador

    except (KeyError, ValueError):

        raise HTTPException(
            status_code=503,
            detail=(
                "Configura PUBLICACION_AUTOR_ID "
                "con el ID del usuario de prueba."
            ),
        ) from None


# =========================================================
# MOSTRAR HTML
# =========================================================

@app.get("/")
def mostrar_formulario():

    return FileResponse(
        FRONTEND / "Creacion.html"
    )


# =========================================================
# UBICACIONES
# =========================================================

@app.get("/api/ubicaciones")
async def buscar_ubicaciones(

    texto: str = Query(
        min_length=3,
        max_length=250
    ),

):

    clave = os.getenv(
        "GEOAPIFY_API_KEY"
    )

    if not clave:

        raise HTTPException(
            status_code=503,
            detail=(
                "Falta configurar la clave "
                "de Geoapify."
            ),
        )

    texto = texto.strip()

    if len(texto) < 3:
        return []

    parametros = {
        "text": texto,
        "apiKey": clave,
        "lang": "es",
        "limit": 5,
        "format": "json",
    }

    try:

        async with httpx.AsyncClient(
            timeout=10
        ) as cliente:

            respuesta = await cliente.get(
                "https://api.geoapify.com/v1/geocode/autocomplete",
                params=parametros,
            )

            respuesta.raise_for_status()

            datos = respuesta.json()

    except (
        httpx.HTTPError,
        ValueError
    ):

        raise HTTPException(
            status_code=502,
            detail=(
                "No se pudo consultar "
                "el servicio de ubicaciones."
            ),
        ) from None

    return [
        lugar["formatted"]
        for lugar in datos.get(
            "results",
            []
        )
        if lugar.get("formatted")
    ]


# =========================================================
# CREAR PUBLICACIÓN
# =========================================================

@app.post(
    "/api/publicaciones",
    status_code=201
)
def crear_publicacion(

    titulo: Annotated[
        str,
        Form(
            min_length=1,
            max_length=200
        )
    ],

    categoria: Annotated[
        Literal[
            "busco",
            "ofrezco"
        ],
        Form()
    ],

    ubicacion: Annotated[
        str,
        Form(
            min_length=1,
            max_length=250
        )
    ],

    precio: Annotated[
        Decimal,
        Form(
            ge=0,
            max_digits=14,
            decimal_places=2
        )
    ],

    tipo: Annotated[
        Literal[
            "Arrendador",
            "Compartida"
        ],
        Form()
    ],

    cupos_totales: Annotated[
        int,
        Form(
            ge=1,
            le=2147483647
        )
    ],

    tipo_vivienda: Annotated[
        Literal[
            "casa",
            "departamento",
            "habitacion"
        ],
        Form()
    ],

    descripcion: Annotated[
        str,
        Form(
            min_length=1,
            max_length=5000
        )
    ],

    permitir_comentarios: Annotated[
        bool,
        Form()
    ] = False,

    imagen: Annotated[
        UploadFile | None,
        File()
    ] = None,

):

    id_usuario = autor_de_prueba()

    titulo = titulo.strip()
    ubicacion = ubicacion.strip()
    descripcion = descripcion.strip()

    if not all([
        titulo,
        ubicacion,
        descripcion
    ]):

        raise HTTPException(
            status_code=422,
            detail=(
                "Completa el título, "
                "la ubicación y la descripción."
            ),
        )

    nombre_imagen = None
    ruta_imagen = None
    contenido = None


    # =====================================================
    # VALIDAR IMAGEN
    # =====================================================

    if imagen and imagen.filename:

        limite = 5 * 1024 * 1024

        contenido = imagen.file.read(
            limite + 1
        )

        if len(contenido) > limite:

            raise HTTPException(
                status_code=413,
                detail=(
                    "La imagen debe pesar "
                    "como máximo 5 MB."
                ),
            )

        try:

            with Image.open(
                BytesIO(contenido)
            ) as foto:

                extensiones = {
                    "JPEG": ".jpg",
                    "PNG": ".png",
                    "WEBP": ".webp",
                }

                extension = extensiones.get(
                    foto.format
                )

                if not extension:

                    raise HTTPException(
                        status_code=422,
                        detail=(
                            "Usa una imagen "
                            "JPG, PNG o WEBP."
                        ),
                    )

                foto.verify()

        except HTTPException:
            raise

        except (
            UnidentifiedImageError,
            OSError,
            ValueError,
            Image.DecompressionBombError,
        ):

            raise HTTPException(
                status_code=422,
                detail=(
                    "El archivo no es "
                    "una imagen válida."
                ),
            ) from None

        nombre_imagen = (
            uuid4().hex
            + extension
        )

        ruta_imagen = (
            IMAGENES
            / nombre_imagen
        )


    # =====================================================
    # GUARDAR PUBLICACIÓN
    # =====================================================

    try:

        with conectar() as conexion:

            existe = conexion.execute(
                """
                SELECT id_usuario

                FROM haycupo.usuario

                WHERE id_usuario = %s

                FOR KEY SHARE
                """,
                (
                    id_usuario,
                ),
            ).fetchone()

            if not existe:

                raise HTTPException(
                    status_code=422,
                    detail=(
                        "El autor configurado no existe. "
                        "Revisa PUBLICACION_AUTOR_ID."
                    ),
                )

            fila = conexion.execute(
                """
                INSERT INTO haycupo.publicacion (
                    id_usuario,
                    tipo,
                    titulo,
                    descripcion,
                    precio,
                    ubicacion,
                    estado,
                    cupos_totales,
                    categoria,
                    tipo_vivienda,
                    permitir_comentarios
                )

                VALUES (
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    %s,
                    'Disponible',
                    %s,
                    %s,
                    %s,
                    %s
                )

                RETURNING id_publicacion
                """,
                (
                    id_usuario,
                    tipo,
                    titulo,
                    descripcion,
                    precio,
                    ubicacion,
                    cupos_totales,
                    categoria,
                    tipo_vivienda,
                    permitir_comentarios,
                ),
            ).fetchone()

            identificador = fila[0]


            # =================================================
            # GUARDAR IMAGEN
            # =================================================

            if ruta_imagen:

                ruta_imagen.write_bytes(
                    contenido
                )

                conexion.execute(
                    """
                    INSERT INTO haycupo.imagen_publicacion (
                        id_publicacion,
                        url,
                        orden
                    )

                    VALUES (
                        %s,
                        %s,
                        0
                    )
                    """,
                    (
                        identificador,
                        f"/imagenes/{nombre_imagen}",
                    ),
                )


    except HTTPException:
        raise

    except (
        psycopg.Error,
        OSError
    ):

        if ruta_imagen:

            try:

                ruta_imagen.unlink(
                    missing_ok=True
                )

            except OSError:

                logging.getLogger(
                    __name__
                ).warning(
                    "No se pudo limpiar "
                    "la imagen."
                )

        logging.getLogger(
            __name__
        ).error(
            "Falló el guardado "
            "de la publicación."
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "No se pudo guardar "
                "la publicación."
            ),
        ) from None


    return {
        "id": identificador,
        "mensaje": (
            "Publicación creada correctamente"
        ),
    }


# =========================================================
# EDITAR PUBLICACIÓN
# =========================================================

@app.patch(
    "/api/publicaciones/{id_publicacion}"
)
def editar_publicacion(

    id_publicacion: int,

    titulo: Annotated[
        str | None,
        Form(max_length=200)
    ] = None,

    categoria: Annotated[
        Literal[
            "busco",
            "ofrezco"
        ] | None,
        Form()
    ] = None,

    ubicacion: Annotated[
        str | None,
        Form(max_length=250)
    ] = None,

    precio: Annotated[
        Decimal | None,
        Form(
            ge=0,
            max_digits=14,
            decimal_places=2
        )
    ] = None,

    tipo: Annotated[
        Literal[
            "Arrendador",
            "Compartida"
        ] | None,
        Form()
    ] = None,

    cupos_totales: Annotated[
        int | None,
        Form(
            ge=1,
            le=2147483647
        )
    ] = None,

    tipo_vivienda: Annotated[
        Literal[
            "casa",
            "departamento",
            "habitacion"
        ] | None,
        Form()
    ] = None,

    descripcion: Annotated[
        str | None,
        Form(max_length=5000)
    ] = None,

    permitir_comentarios: Annotated[
        bool | None,
        Form()
    ] = None,

):

    id_usuario = autor_de_prueba()


    # =====================================================
    # LIMPIAR TEXTOS
    # =====================================================

    if titulo is not None:

        titulo = titulo.strip()

        if not titulo:

            raise HTTPException(
                status_code=422,
                detail=(
                    "El título no puede "
                    "estar vacío."
                ),
            )


    if ubicacion is not None:

        ubicacion = ubicacion.strip()

        if not ubicacion:

            raise HTTPException(
                status_code=422,
                detail=(
                    "La ubicación no puede "
                    "estar vacía."
                ),
            )


    if descripcion is not None:

        descripcion = descripcion.strip()

        if not descripcion:

            raise HTTPException(
                status_code=422,
                detail=(
                    "La descripción no puede "
                    "estar vacía."
                ),
            )


    valores = [
        titulo,
        categoria,
        ubicacion,
        precio,
        tipo,
        cupos_totales,
        tipo_vivienda,
        descripcion,
        permitir_comentarios,
    ]


    if all(
        valor is None
        for valor in valores
    ):

        raise HTTPException(
            status_code=422,
            detail=(
                "Debes enviar al menos "
                "un campo para editar."
            ),
        )


    # =====================================================
    # EDITAR EN POSTGRESQL
    # =====================================================

    try:

        with conectar() as conexion:

            publicacion = conexion.execute(
                """
                SELECT
                    id_publicacion,
                    estado

                FROM haycupo.publicacion

                WHERE id_publicacion = %s
                AND id_usuario = %s

                FOR UPDATE
                """,
                (
                    id_publicacion,
                    id_usuario,
                ),
            ).fetchone()


            if not publicacion:

                raise HTTPException(
                    status_code=404,
                    detail=(
                        "La publicación no existe "
                        "o no te pertenece."
                    ),
                )


            if publicacion[1] == "Cerrada":

                raise HTTPException(
                    status_code=409,
                    detail=(
                        "No puedes editar una "
                        "publicación cerrada."
                    ),
                )


            fila = conexion.execute(
                """
                UPDATE haycupo.publicacion

                SET
                    titulo =
                        COALESCE(%s, titulo),

                    categoria =
                        COALESCE(%s, categoria),

                    ubicacion =
                        COALESCE(%s, ubicacion),

                    precio =
                        COALESCE(%s, precio),

                    tipo =
                        COALESCE(%s, tipo),

                    cupos_totales =
                        COALESCE(%s, cupos_totales),

                    tipo_vivienda =
                        COALESCE(%s, tipo_vivienda),

                    descripcion =
                        COALESCE(%s, descripcion),

                    permitir_comentarios =
                        COALESCE(
                            %s,
                            permitir_comentarios
                        )

                WHERE id_publicacion = %s
                AND id_usuario = %s

                RETURNING
                    id_publicacion,
                    titulo,
                    categoria,
                    ubicacion,
                    precio,
                    tipo,
                    cupos_totales,
                    tipo_vivienda,
                    descripcion,
                    permitir_comentarios,
                    estado
                """,
                (
                    titulo,
                    categoria,
                    ubicacion,
                    precio,
                    tipo,
                    cupos_totales,
                    tipo_vivienda,
                    descripcion,
                    permitir_comentarios,
                    id_publicacion,
                    id_usuario,
                ),
            ).fetchone()


    except HTTPException:
        raise

    except psycopg.Error:

        logging.getLogger(
            __name__
        ).error(
            "Falló la edición "
            "de la publicación."
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "No se pudo editar "
                "la publicación."
            ),
        ) from None


    return {
        "mensaje": (
            "Publicación editada correctamente"
        ),

        "publicacion": {

            "id":
                fila[0],

            "titulo":
                fila[1],

            "categoria":
                fila[2],

            "ubicacion":
                fila[3],

            "precio":
                float(fila[4]),

            "tipo":
                fila[5],

            "cupos_totales":
                fila[6],

            "tipo_vivienda":
                fila[7],

            "descripcion":
                fila[8],

            "permitir_comentarios":
                fila[9],

            "estado":
                fila[10],
        },
    }


# =========================================================
# CERRAR PUBLICACIÓN
# =========================================================

@app.patch(
    "/api/publicaciones/{id_publicacion}/cerrar"
)
def cerrar_publicacion(
    id_publicacion: int
):

    id_usuario = autor_de_prueba()

    try:

        with conectar() as conexion:

            fila = conexion.execute(
                """
                UPDATE haycupo.publicacion

                SET estado = 'Cerrada'

                WHERE id_publicacion = %s
                AND id_usuario = %s

                RETURNING
                    id_publicacion,
                    estado
                """,
                (
                    id_publicacion,
                    id_usuario,
                ),
            ).fetchone()


            if not fila:

                raise HTTPException(
                    status_code=404,
                    detail=(
                        "La publicación no existe "
                        "o no te pertenece."
                    ),
                )


    except HTTPException:
        raise

    except psycopg.Error:

        logging.getLogger(
            __name__
        ).error(
            "Falló el cierre "
            "de la publicación."
        )

        raise HTTPException(
            status_code=500,
            detail=(
                "No se pudo cerrar "
                "la publicación."
            ),
        ) from None


    return {
        "mensaje":
            "Publicación cerrada correctamente",

        "id":
            fila[0],

        "estado":
            fila[1],
    }