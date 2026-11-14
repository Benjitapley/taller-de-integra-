from fastapi.staticfiles import StaticFiles
import os
from contextlib import asynccontextmanager
from io import BytesIO
from decimal import Decimal
import logging
from pathlib import Path
from typing import Annotated, Literal
from uuid import uuid4
from dotenv import load_dotenv

import httpx
import psycopg
from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile, Depends
from backend.match_conexion_service.routes import router as conexion_router
from backend.auth_service.main import auth_router
from backend.auth_service.security import get_current_user
from backend.auth_service.config import get_settings
from backend.main.admin import router as admin_router

from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from PIL import Image, UnidentifiedImageError
from pydantic import ValidationError
from backend.publicaciones_service.schemas import (
    PublicacionCreada, PublicacionResumen, preferencias_desde_formulario,
)

load_dotenv()
# ==========================================
# 1. CONFIGURACIÓN DE CARPETAS
# ==========================================

BASE = Path(__file__).resolve().parent


IMAGENES = BASE / "imagenes"



# ==========================================
# 2. CONEXIÓN CON POSTGRESQL (SUPABASE)
# ==========================================

def conectar():
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("Falta configurar DATABASE_URL en .env")
    return psycopg.connect(url, connect_timeout=10)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Deshabilitado por defecto; si se habilita, validar secretos antes de la BD.
    auth_settings = get_settings()
    IMAGENES.mkdir(parents=True, exist_ok=True)
    with conectar() as conexion:
        conexion.execute("""
            SELECT id_publicacion, id_usuario, tipo, titulo, descripcion,
                   precio, ubicacion, estado, cupos_totales,
                   categoria, tipo_vivienda, permitir_comentarios
            FROM haycupo.publicacion LIMIT 0
        """)
        conexion.execute("SELECT id_imagen, id_publicacion, url, orden FROM haycupo.imagen_publicacion LIMIT 0")
        if mascotas_detalle_habilitadas():
            conexion.execute("SELECT tipos_mascotas_aceptadas, condiciones_mascotas FROM haycupo.publicacion LIMIT 0")
        if auth_settings.enabled:
            conexion.execute("SELECT id_usuario, verificado FROM haycupo.usuario LIMIT 0")
            conexion.execute("SELECT id, id_usuario, codigo_hash, intentos, usado, creado_en, expira_en, enviado_en FROM haycupo.codigo_verificacion LIMIT 0")
            conexion.execute("SELECT jti, id_usuario, expira_en, revocado FROM haycupo.sesion_jwt LIMIT 0")
    yield


app = FastAPI(lifespan=lifespan)


@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    # Conservar detail/loc/msg/type sin reflejar passwords, códigos o ctx.
    return JSONResponse(status_code=422, content={"detail": [
        {"loc": list(error["loc"]), "msg": error["msg"], "type": error["type"]}
        for error in exc.errors()
    ]})


@app.middleware("http")
async def private_no_store(request, call_next):
    response = await call_next(request)
    path = request.url.path
    if (path.startswith(("/auth/", "/conexiones", "/api/admin"))
        or path in {"/api/perfil", "/api/mis-publicaciones"}
        or path.startswith("/api/publicaciones/")
        or (path.startswith("/api/publicaciones") and request.method != "GET")):
        response.headers["Cache-Control"] = "no-store"
    return response

# CONFIGURACIÓN DE CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in os.getenv("WEB_ORIGINS", "http://localhost:3000,http://127.0.0.1:3000").split(",") if origin.strip() and origin.strip() != "*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(conexion_router)
app.include_router(auth_router)
app.include_router(admin_router)

app.mount("/imagenes", StaticFiles(directory=IMAGENES, check_dir=False), name="imagenes")


# ==========================================
# 4. ENDPOINTS API (BACKEND)
# ==========================================

# AUTOCOMPLETADO DE UBICACIÓN
@app.get("/api/ubicaciones")
async def buscar_ubicaciones(texto: str = Query(min_length=3, max_length=250)):
    clave = os.getenv("GEOAPIFY_API_KEY")
    if not clave:
        raise HTTPException(status_code=503, detail="Falta configurar la clave de Geoapify.")
    if len(texto.strip()) < 3:
        return []

    parametros = {"text": texto.strip(), "apiKey": clave, "lang": "es", "limit": 5, "format": "json"}
    try:
        async with httpx.AsyncClient(timeout=10) as cliente:
            respuesta = await cliente.get("https://api.geoapify.com/v1/geocode/autocomplete", params=parametros)
            respuesta.raise_for_status()
            datos = respuesta.json()
    except Exception:
        raise HTTPException(status_code=502, detail="No se pudo consultar ubicaciones.") from None

    return [lugar["formatted"] for lugar in datos.get("results", []) if lugar.get("formatted")]


def mascotas_detalle_habilitadas():
    return os.getenv("PUBLICACIONES_MASCOTAS_DETALLE_ENABLED", "false").strip().lower() == "true"


def columnas_mascotas(prefijo=""):
    if mascotas_detalle_habilitadas():
        return f"{prefijo}tipos_mascotas_aceptadas, {prefijo}condiciones_mascotas"
    return "ARRAY[]::varchar[], NULL::text"


def validar_mascotas(mascota, tipos_json, condiciones, anteriores=None):
    if not mascotas_detalle_habilitadas() and (tipos_json is not None or condiciones is not None):
        raise HTTPException(503, "Las preferencias detalladas de mascotas requieren habilitación y migración del esquema.")
    # Los clientes actuales solo envían si/no; conservan ese contrato al integrarse.
    if tipos_json is None and condiciones is None and not (anteriores or {}).get("tipos_mascotas_aceptadas"):
        anteriores = {**(anteriores or {}), "mascota": mascota}
    try:
        return preferencias_desde_formulario(mascota, tipos_json, condiciones, anteriores)
    except ValidationError as error:
        mensaje = error.errors()[0]["msg"].removeprefix("Value error, ")
        raise HTTPException(422, mensaje) from None
    except ValueError as error:
        raise HTTPException(422, str(error)) from None


def resumen_cupos(identificador, estado, total):
    estado = estado or "Disponible"
    return {"id": identificador, "estado": estado, "cupos_totales": total,
            # Activa necesita el contrato de ocupación de Convivencia: no inventar vacantes.
            "cupos_disponibles": (0 if estado.lower() == "cerrada" else
                                  total if estado.lower() == "disponible" else None)}


def preparar_imagen(imagen):
    if not imagen or not imagen.filename:
        return None, None
    contenido = imagen.file.read(5 * 1024 * 1024 + 1)
    if len(contenido) > 5 * 1024 * 1024:
        raise HTTPException(413, "La imagen debe pesar como máximo 5 MB.")
    try:
        with Image.open(BytesIO(contenido)) as foto:
            extension = {"JPEG": ".jpg", "PNG": ".png", "WEBP": ".webp"}.get(foto.format)
            if not extension or foto.width * foto.height > 20_000_000:
                raise ValueError("Formato o dimensiones no permitidos")
            foto.verify()
        with Image.open(BytesIO(contenido)) as foto:
            for frame in range(getattr(foto, "n_frames", 1)):
                foto.seek(frame)
                if foto.width * foto.height > 20_000_000:
                    raise ValueError("Dimensiones no permitidas")
                foto.load()
    except Exception:
        raise HTTPException(422, "Usa una imagen JPG, PNG o WEBP válida de hasta 20 megapíxeles.") from None
    return IMAGENES / (uuid4().hex + extension), contenido


# LISTAR Y BUSCAR PUBLICACIONES (Para el inicio)
# La ruta estática /buscar se registra antes de /{id_pub}.
@app.get("/api/publicaciones", response_model=list[PublicacionResumen],
         tags=["Publicaciones"], summary="Listar arriendos")
@app.get("/api/publicaciones/buscar", response_model=list[PublicacionResumen],
         tags=["Publicaciones"], summary="Buscar arriendos con filtros")
def obtener_publicaciones(
    consulta: Annotated[str | None, Query(max_length=250, description="Parte de la ubicación")] = None,
    personas: Annotated[Literal["1", "2", "3"] | None, Query(description="1, 2 o 3 (tres o más personas)")] = None,
    tipo: Annotated[Literal["casa", "departamento", "habitacion"] | None, Query(description="Tipo de vivienda")] = None,
    mascotas: Annotated[Literal["si", "no"] | None, Query()] = None,
    precio_min: Annotated[Decimal | None, Query(ge=0, max_digits=14, decimal_places=2)] = None,
    precio_max: Annotated[Decimal | None, Query(ge=0, max_digits=14, decimal_places=2)] = None,
    categoria: Annotated[Literal["busco", "ofrezco"] | None, Query()] = None,
    cupos_min: Annotated[int | None, Query(ge=1, le=2147483647)] = None,
    tipo_vivienda: Annotated[Literal["casa", "departamento", "habitacion"] | None, Query()] = None,
    mascota: Annotated[Literal["si", "no"] | None, Query()] = None,
    limite: Annotated[int | None, Query(ge=1, le=100, description="Máximo de resultados; omitir para listar todos")] = None,
    offset: Annotated[int, Query(ge=0, le=9223372036854775807, description="Resultados a omitir para paginar")] = 0,
):
    if precio_min is not None and precio_max is not None and precio_min > precio_max:
        raise HTTPException(status_code=422, detail="El precio mínimo no puede superar al máximo.")
    if consulta and "\x00" in consulta:
        raise HTTPException(422, "La ubicación no puede contener caracteres nulos.")

    if tipo is not None and tipo_vivienda is not None and tipo != tipo_vivienda:
        raise HTTPException(422, "Los filtros de vivienda son incompatibles.")
    if mascotas is not None and mascota is not None and mascotas != mascota:
        raise HTTPException(422, "Los filtros de mascotas son incompatibles.")
    tipo = tipo_vivienda if tipo_vivienda is not None else tipo
    mascotas = mascota if mascota is not None else mascotas
    filtros = ["LOWER(COALESCE(p.estado, 'Disponible')) IN ('disponible', 'activa')", "p.cupos_totales > 0"]
    parametros = []
    if consulta and consulta.strip():
        # %, _ y la barra se buscan como texto, no como comodines de LIKE.
        ubicacion = consulta.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        filtros.append("(p.ubicacion ILIKE %s OR p.titulo ILIKE %s OR p.descripcion ILIKE %s)")
        parametros.extend([f"%{ubicacion}%"] * 3)
    if personas is not None:
        filtros.append("p.cupos_totales >= %s" if personas == "3" else "p.cupos_totales = %s")
        parametros.append(int(personas))
    if tipo is not None:
        filtros.append("p.tipo_vivienda = %s")
        parametros.append(tipo)
    if cupos_min is not None:
        filtros.append("p.cupos_totales >= %s")
        parametros.append(cupos_min)
    if mascotas is not None:
        filtros.append("p.mascota = %s")
        parametros.append(mascotas)
    if precio_min is not None:
        filtros.append("p.precio >= %s")
        parametros.append(precio_min)
    if precio_max is not None:
        filtros.append("p.precio <= %s")
        parametros.append(precio_max)
    if categoria is not None:
        filtros.append("p.categoria = %s")
        parametros.append(categoria)

    sql = f"""
        SELECT p.id_publicacion, p.titulo, p.precio, p.ubicacion, p.cupos_totales,
               p.tipo_vivienda,
               (SELECT i.url FROM haycupo.imagen_publicacion i
                WHERE i.id_publicacion = p.id_publicacion
                ORDER BY i.orden, i.id_imagen LIMIT 1) AS imagen_url,
               p.categoria, p.descripcion, p.mascota, p.contenido,
               {columnas_mascotas('p.')}, p.estado, p.tipo
        FROM haycupo.publicacion p
    """
    if filtros:
        sql += " WHERE " + " AND ".join(filtros)
    sql += " ORDER BY p.id_publicacion DESC"
    if limite is not None:
        sql += " LIMIT %s"
        parametros.append(limite)
    sql += " OFFSET %s"
    parametros.append(offset)

    try:
        with conectar() as conexion:
            registros = conexion.execute(sql, tuple(parametros)).fetchall()

            publicaciones = []
            for row in registros:
                cupos = resumen_cupos(row[0], row[13], row[4])
                # No anunciar vacantes de Activa mientras falte la consulta de
                # ocupación acordada con Convivencia. El detalle y el historial
                # conservan esos avisos y muestran cupos por confirmar.
                if cupos["cupos_disponibles"] is None or cupos["cupos_disponibles"] <= 0:
                    continue
                desc_final = row[10] if row[10] else row[8]
                publicaciones.append({
                    **cupos,
                    "titulo": row[1], "precio": float(row[2]), "ubicacion": row[3],
                    "tipo_vivienda": row[5], "imagen": row[6], "tipo": row[14],
                    "categoria": row[7], "descripcion": desc_final, "mascota": row[9],
                    "tipos_mascotas_aceptadas": row[11] or [],
                    "condiciones_mascotas": row[12],
                })
            return publicaciones
    except Exception:
        raise HTTPException(status_code=500, detail="Error al cargar publicaciones")


# OBTENER SOLO MIS PUBLICACIONES (Para el CRUD)
@app.get("/api/mis-publicaciones")
def obtener_mis_publicaciones(id_usuario: int = Depends(get_current_user)):
    try:
        with conectar() as conexion:
            registros = conexion.execute("""
                SELECT p.id_publicacion, p.titulo, p.precio, p.estado, p.tipo_vivienda, p.ubicacion, p.cupos_totales,
                       (SELECT i.url FROM haycupo.imagen_publicacion i
                        WHERE i.id_publicacion = p.id_publicacion
                        ORDER BY i.orden, i.id_imagen LIMIT 1)
                FROM haycupo.publicacion p
                WHERE p.id_usuario = %s
                ORDER BY p.id_publicacion DESC
            """, (id_usuario,)).fetchall()

            return [{**resumen_cupos(r[0], r[3], r[6]), "titulo": r[1], "precio": float(r[2]),
                     "tipo": r[4], "ubicacion": r[5], "cupos": r[6], "imagen": r[7]}
                    for r in registros]
    except Exception:
        raise HTTPException(status_code=500, detail="Error al cargar tus publicaciones")


# OBTENER UNA SOLA PUBLICACIÓN (Para rellenar el formulario al editar)
@app.get("/api/publicaciones/{id_pub}", tags=["Publicaciones"])
def obtener_una_publicacion(id_pub: int, id_usuario: int = Depends(get_current_user)):
    return detalle_publicacion(id_pub, id_usuario)


@app.get("/api/publicaciones/{id_pub}/detalle", tags=["Publicaciones"], summary="Consultar detalle público")
def obtener_detalle_publico(id_pub: int):
    return detalle_publicacion(id_pub)


def detalle_publicacion(id_pub: int, propietario: int | None = None):
    if id_pub < 1:
        raise HTTPException(404, "Publicación no encontrada")
    condicion = " AND p.id_usuario = %s" if propietario is not None else ""
    parametros = (id_pub, propietario) if propietario is not None else (id_pub,)
    try:
        with conectar() as conexion:
            r = conexion.execute(f"""
                SELECT p.titulo, p.categoria, p.tipo_vivienda, p.ubicacion, p.precio, p.cupos_totales,
                       p.mascota, COALESCE(NULLIF(p.contenido, ''), p.descripcion),
                       {columnas_mascotas('p.')},
                       p.estado, p.tipo, p.permitir_comentarios,
                       (SELECT i.url FROM haycupo.imagen_publicacion i
                        WHERE i.id_publicacion = p.id_publicacion
                        ORDER BY i.orden, i.id_imagen LIMIT 1)
                FROM haycupo.publicacion p WHERE p.id_publicacion = %s{condicion}
            """, parametros).fetchone()
            if r is None:
                raise HTTPException(status_code=404, detail="Publicación no encontrada")
            return {
                **resumen_cupos(id_pub, r[10], r[5]),
                "titulo": r[0], "categoria": r[1], "tipo_vivienda": r[2],
                "ubicacion": r[3], "precio": r[4], "mascota": r[6], "descripcion": r[7],
                "tipos_mascotas_aceptadas": r[8] or [], "condiciones_mascotas": r[9],
                "tipo": r[11], "permitir_comentarios": r[12], "imagen": r[13],
            }
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Error al cargar la publicación") from None


@app.get("/api/publicaciones/{id_pub}/cupos", tags=["Publicaciones"], summary="Consultar cupos actuales")
def consultar_cupos(id_pub: int):
    try:
        with conectar() as conexion:
            fila = conexion.execute("""
                SELECT estado, cupos_totales FROM haycupo.publicacion WHERE id_publicacion = %s
            """, (id_pub,)).fetchone()
            if fila is None:
                raise HTTPException(status_code=404, detail="Publicación no encontrada")
            return resumen_cupos(id_pub, fila[0], fila[1])
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="No se pudieron consultar los cupos") from None


@app.patch("/api/publicaciones/{id_pub}/cerrar", tags=["Publicaciones"], summary="Cerrar una publicación propia")
def cerrar_publicacion(id_pub: int, id_usuario: int = Depends(get_current_user)):
    try:
        with conectar() as conexion:
            fila = conexion.execute("""
                UPDATE haycupo.publicacion SET estado = 'Cerrada'
                WHERE id_publicacion = %s AND id_usuario = %s
                RETURNING estado, cupos_totales
            """, (id_pub, id_usuario)).fetchone()
            if fila is None:
                raise HTTPException(status_code=404, detail="Publicación no encontrada")
            return resumen_cupos(id_pub, fila[0], fila[1])
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="No se pudo cerrar la publicación") from None


# CREAR PUBLICACIÓN NUEVA
@app.post("/api/publicaciones", status_code=201, response_model=PublicacionCreada,
          tags=["Publicaciones"], summary="Publicar un arriendo")
def crear_publicacion(
    titulo: Annotated[str, Form(min_length=1, max_length=200)],
    categoria: Annotated[Literal["busco", "ofrezco"], Form()],
    ubicacion: Annotated[str, Form(min_length=1, max_length=250)],
    precio: Annotated[Decimal, Form(ge=0, max_digits=14, decimal_places=2)],
    tipo: Annotated[Literal["Arrendador", "Compartida"], Form()],
    cupos_totales: Annotated[int, Form(ge=1, le=2147483647)],
    tipo_vivienda: Annotated[Literal["casa", "departamento", "habitacion"], Form()],
    descripcion: Annotated[str, Form(min_length=1, max_length=5000)],
    mascota: Annotated[Literal["si", "no"], Form()] = "no",
    tipos_mascotas_aceptadas: Annotated[str | None, Form(max_length=1000)] = None,
    condiciones_mascotas: Annotated[str | None, Form(max_length=2000)] = None,
    permitir_comentarios: Annotated[bool, Form()] = False,
    imagen: Annotated[UploadFile | None, File()] = None,
    id_usuario: int = Depends(get_current_user)
):
    titulo = titulo.strip()
    ubicacion = ubicacion.strip()
    texto_desc = descripcion.strip()
    permitir = permitir_comentarios

    if any(not value or "\x00" in value for value in (titulo, ubicacion, texto_desc)):
        raise HTTPException(status_code=422, detail="Completa el título, ubicación y descripción.")

    preferencias = validar_mascotas(mascota, tipos_mascotas_aceptadas, condiciones_mascotas)

    ruta_imagen, contenido_img = preparar_imagen(imagen)

    try:
        with conectar() as conexion:
            extra_columnas = ", tipos_mascotas_aceptadas, condiciones_mascotas" if mascotas_detalle_habilitadas() else ""
            extra_valores = ", %s, %s" if extra_columnas else ""
            parametros = (id_usuario, tipo, titulo, texto_desc, precio, ubicacion,
                          cupos_totales, categoria, tipo_vivienda, permitir, preferencias.mascota, texto_desc)
            if extra_columnas:
                parametros += (preferencias.tipos_mascotas_aceptadas, preferencias.condiciones_mascotas)
            fila = conexion.execute(
                f"""
                INSERT INTO haycupo.publicacion (
                    id_usuario, tipo, titulo, descripcion, precio, ubicacion,
                    estado, cupos_totales, categoria, tipo_vivienda,
                    permitir_comentarios, mascota, contenido{extra_columnas}
                )
                VALUES (%s, %s, %s, %s, %s, %s, 'Disponible', %s, %s, %s, %s, %s, %s{extra_valores})
                RETURNING id_publicacion
                """,
                parametros,
            ).fetchone()

            identificador = fila[0]

            if ruta_imagen:
                ruta_imagen.write_bytes(contenido_img)
                conexion.execute(
                    "INSERT INTO haycupo.imagen_publicacion (id_publicacion, url, orden) VALUES (%s, %s, 0)",
                    (identificador, f"/imagenes/{ruta_imagen.name}")
                )
    except Exception:
        if ruta_imagen:
            ruta_imagen.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail="Error al guardar.") from None

    return {"id": identificador, "mensaje": "Publicación creada"}


# ACTUALIZAR UNA PUBLICACIÓN EXISTENTE
@app.put("/api/publicaciones/{id_pub}", tags=["Publicaciones"], summary="Editar una publicación propia")
def actualizar_publicacion(
    id_pub: int,
    titulo: Annotated[str, Form(min_length=1, max_length=200)],
    categoria: Annotated[Literal["busco", "ofrezco"], Form()],
    ubicacion: Annotated[str, Form(min_length=1, max_length=250)],
    precio: Annotated[Decimal, Form(ge=0, max_digits=14, decimal_places=2)],
    tipo_vivienda: Annotated[Literal["casa", "departamento", "habitacion"], Form()],
    descripcion: Annotated[str, Form(min_length=1, max_length=5000)],
    cupos_totales: Annotated[int, Form(ge=1, le=2147483647)],
    tipo: Annotated[Literal["Arrendador", "Compartida"] | None, Form()] = None,
    mascota: Annotated[Literal["si", "no"], Form()] = "no",
    tipos_mascotas_aceptadas: Annotated[str | None, Form(max_length=1000)] = None,
    condiciones_mascotas: Annotated[str | None, Form(max_length=2000)] = None,
    permitir_comentarios: Annotated[bool | None, Form()] = None,
    imagen: Annotated[UploadFile | None, File()] = None,
    id_usuario: int = Depends(get_current_user)
):
    titulo, ubicacion, descripcion = titulo.strip(), ubicacion.strip(), descripcion.strip()
    if any(not value or "\x00" in value for value in (titulo, ubicacion, descripcion)):
        raise HTTPException(status_code=422, detail="Completa el título, ubicación y descripción.")
    if not mascotas_detalle_habilitadas():
        validar_mascotas(mascota, tipos_mascotas_aceptadas, condiciones_mascotas)
    ruta_imagen, contenido_img = preparar_imagen(imagen)
    imagen_escrita = False
    try:
        with conectar() as conexion:
            anterior = conexion.execute(f"""
                SELECT mascota, {columnas_mascotas()}
                FROM haycupo.publicacion
                WHERE id_publicacion = %s AND id_usuario = %s
                FOR UPDATE
            """, (id_pub, id_usuario)).fetchone()
            if anterior is None:
                raise HTTPException(status_code=404, detail="Publicación no encontrada")

            preferencias = validar_mascotas(
                mascota, tipos_mascotas_aceptadas, condiciones_mascotas,
                {
                    "mascota": anterior[0],
                    "tipos_mascotas_aceptadas": anterior[1],
                    "condiciones_mascotas": anterior[2],
                },
            )
            extra_set = "tipos_mascotas_aceptadas=%s, condiciones_mascotas=%s," if mascotas_detalle_habilitadas() else ""
            parametros = (titulo, categoria, ubicacion, precio, tipo_vivienda, descripcion,
                          cupos_totales, preferencias.mascota, descripcion)
            if extra_set:
                parametros += (preferencias.tipos_mascotas_aceptadas, preferencias.condiciones_mascotas)
            parametros += (tipo, permitir_comentarios, id_pub, id_usuario)
            conexion.execute(f"""
                UPDATE haycupo.publicacion
                SET titulo=%s, categoria=%s, ubicacion=%s, precio=%s,
                    tipo_vivienda=%s, descripcion=%s, cupos_totales=%s, mascota=%s, contenido=%s,
                    {extra_set}
                    tipo=COALESCE(%s, tipo), permitir_comentarios=COALESCE(%s, permitir_comentarios)
                WHERE id_publicacion=%s AND id_usuario=%s
            """, parametros)
            if ruta_imagen:
                imagen_escrita = True
                ruta_imagen.write_bytes(contenido_img)
                # shortcut: se conserva el archivo anterior; añadir limpieza al gestionar el almacenamiento de imágenes.
                portada = conexion.execute("""
                    UPDATE haycupo.imagen_publicacion SET url = %s
                    WHERE id_imagen = (
                        SELECT id_imagen FROM haycupo.imagen_publicacion
                        WHERE id_publicacion = %s ORDER BY orden, id_imagen LIMIT 1
                    ) RETURNING id_imagen
                """, (f"/imagenes/{ruta_imagen.name}", id_pub)).fetchone()
                if portada is None:
                    conexion.execute("""
                        INSERT INTO haycupo.imagen_publicacion (id_publicacion, url, orden)
                        VALUES (%s, %s, 0)
                    """, (id_pub, f"/imagenes/{ruta_imagen.name}"))
        return {"mensaje": "Publicación actualizada correctamente"}
    except HTTPException:
        raise
    except Exception:
        if imagen_escrita:
            ruta_imagen.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail="No se pudo actualizar la base de datos") from None


# ELIMINAR UNA PUBLICACIÓN
@app.delete("/api/publicaciones/{id_pub}")
def borrar_publicacion(id_pub: int, id_usuario: int = Depends(get_current_user)):
    try:
        with conectar() as conexion:
            owner = conexion.execute("SELECT id_publicacion FROM haycupo.publicacion WHERE id_publicacion = %s AND id_usuario = %s FOR UPDATE", (id_pub, id_usuario)).fetchone()
            if owner is None:
                raise HTTPException(404, "Publicación no encontrada o sin permiso.")
            conexion.execute("DELETE FROM haycupo.imagen_publicacion WHERE id_publicacion = %s", (id_pub,))
            conexion.execute("DELETE FROM haycupo.publicacion WHERE id_publicacion = %s AND id_usuario = %s", (id_pub, id_usuario))
        return {"mensaje": "Publicación eliminada"}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Error al eliminar")


# OBTENER DATOS DEL PERFIL
@app.get("/api/perfil")
def obtener_perfil(id_usuario: int = Depends(get_current_user)):
    try:
        with conectar() as conexion:
            user = conexion.execute("SELECT nombre, edad, ocupacion, ciudad, breve_descripcion, sobre_mi, foto_perfil, verificado FROM haycupo.usuario WHERE id_usuario = %s", (id_usuario,)).fetchone()
            pubs = conexion.execute("SELECT COUNT(*) FROM haycupo.publicacion WHERE id_usuario = %s", (id_usuario,)).fetchone()[0]

            if not user:
                raise HTTPException(status_code=404, detail="Usuario no encontrado")

            return {
                "nombre": user[0] or "Usuario",
                "edad": user[1] if user[1] is not None else "",
                "ocupacion": user[2] or "",
                "ciudad": user[3] or "",
                "breve_descripcion": user[4] or "",
                "sobre_mi": user[5] or "",
                "foto_perfil": user[6] or None,
                "verificado": user[7],
                "total_publicaciones": pubs
            }
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Error al cargar el perfil")

# GUARDAR EDICIÓN DE PERFIL
@app.put("/api/perfil")
def actualizar_perfil(
    edad: Annotated[str, Form()] = "", ocupacion: Annotated[str, Form()] = "",
    ciudad: Annotated[str, Form()] = "", breve_descripcion: Annotated[str, Form()] = "",
    sobre_mi: Annotated[str, Form()] = "", foto: Annotated[UploadFile | None, File()] = None,
    id_usuario: int = Depends(get_current_user)
):
    # Full form replacement, as in the original HTML. Empty age maps to SQL NULL.
    edad = edad.strip()
    if edad and (len(edad) > 3 or not edad.isascii() or not edad.isdecimal() or not 0 <= int(edad) <= 120):
        raise HTTPException(422, "La edad debe ser un número entre 0 y 120, o quedar vacía.")
    edad_db = int(edad) if edad else None
    ocupacion, ciudad = ocupacion.strip(), ciudad.strip()
    breve_descripcion, sobre_mi = breve_descripcion.strip(), sobre_mi.strip()
    if any(len(value) > limit or "\x00" in value for value, limit in
           [(ocupacion, 100), (ciudad, 100), (breve_descripcion, 255), (sobre_mi, 5000)]):
        raise HTTPException(422, "Revisa los límites de los campos del perfil.")
    url_foto = ruta_foto = None
    if foto and foto.filename:
        contenido_img = foto.file.read(5 * 1024 * 1024 + 1)
        if len(contenido_img) > 5 * 1024 * 1024:
            raise HTTPException(413, "La fotografía debe pesar como máximo 5 MB.")
        try:
            with Image.open(BytesIO(contenido_img)) as image:
                extension = {"JPEG": ".jpg", "PNG": ".png", "WEBP": ".webp"}.get(image.format)
                if not extension or image.width * image.height > 20_000_000:
                    raise ValueError("Unsupported image")
                image.verify()
            # verify() checks structure but does not decode JPEG pixel data.
            # Reopen after verify(), which consumes the decoder, and load every
            # frame before any permanent file or profile update is attempted.
            with Image.open(BytesIO(contenido_img)) as image:
                for frame in range(getattr(image, "n_frames", 1)):
                    image.seek(frame)
                    if image.width * image.height > 20_000_000:
                        raise ValueError("Unsupported image dimensions")
                    image.load()
        except Exception:
            raise HTTPException(422, "Usa una fotografía JPG, PNG o WEBP válida de hasta 20 megapíxeles.") from None
        nombre_imagen = uuid4().hex + extension
        ruta_foto = IMAGENES / nombre_imagen
        url_foto = f"/imagenes/{nombre_imagen}"

    try:
        with conectar() as conexion:
            if ruta_foto:
                ruta_foto.write_bytes(contenido_img)
            if url_foto:
                conexion.execute("UPDATE haycupo.usuario SET edad=%s, ocupacion=%s, ciudad=%s, breve_descripcion=%s, sobre_mi=%s, foto_perfil=%s WHERE id_usuario=%s",
                                 (edad_db, ocupacion, ciudad, breve_descripcion, sobre_mi, url_foto, id_usuario))
            else:
                conexion.execute("UPDATE haycupo.usuario SET edad=%s, ocupacion=%s, ciudad=%s, breve_descripcion=%s, sobre_mi=%s WHERE id_usuario=%s",
                                 (edad_db, ocupacion, ciudad, breve_descripcion, sobre_mi, id_usuario))
        return {"mensaje": "Perfil actualizado permanentemente"}
    except Exception:
        if ruta_foto:
            ruta_foto.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail="Error al guardar en la base de datos")
