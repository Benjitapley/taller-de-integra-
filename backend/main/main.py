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

from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from PIL import Image, UnidentifiedImageError

load_dotenv()
# ==========================================
# 1. CONFIGURACIÓN DE CARPETAS
# ==========================================

BASE = Path(__file__).resolve().parent
RAIZ_PROYECTO = BASE.parent.parent

FRONTEND = RAIZ_PROYECTO / "frontend"
FRONTEND_CREACION = FRONTEND / "Creacion_De_publicacion"
FRONTEND_PRINCIPAL = FRONTEND / "PaginaPrincipal"
FRONTEND_ICONOS = FRONTEND / "Iconos"
FRONTEND_PERFIL = FRONTEND / "PerfilU"

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
    if (path.startswith(("/auth/", "/conexiones"))
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

# MONTAJE DE CARPETAS ESTÁTICAS
app.mount("/static_creacion", StaticFiles(directory=FRONTEND_CREACION), name="static_creacion")
app.mount("/static_principal", StaticFiles(directory=FRONTEND_PRINCIPAL), name="static_principal")
app.mount("/imagenes", StaticFiles(directory=IMAGENES, check_dir=False), name="imagenes")
app.mount("/Iconos", StaticFiles(directory=FRONTEND_ICONOS), name="iconos")
app.mount("/PerfilU", StaticFiles(directory=FRONTEND_PERFIL), name="perfil_u")

# ==========================================
# 3. RUTAS PARA MOSTRAR LOS HTML (FRONTEND)
# ==========================================
@app.get("/")
def mostrar_login():
    return FileResponse(FRONTEND_PRINCIPAL / "Auth_app(login)" / "auth_app.html")

@app.get("/inicio")
def mostrar_pagina_principal():
    return FileResponse(FRONTEND_PRINCIPAL / "hayCupo.html")

@app.get("/crear")
def mostrar_formulario_creacion():
    return FileResponse(FRONTEND_CREACION / "publicacion.html")

@app.get("/perfil")
def mostrar_pantalla_perfil():
    return FileResponse(FRONTEND_PERFIL / "perfil.html")

@app.get("/mis-publicaciones")
def mostrar_mis_publicaciones():
    # Carga tu CRUD
    return FileResponse(FRONTEND_PRINCIPAL / "PublicacionesU" / "mis_publicaciones.html")

@app.get("/editar-publicacion")
def mostrar_editar_publicacion():
    # Reutiliza el HTML de creación para editar
    return FileResponse(FRONTEND_CREACION / "publicacion.html")


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


# OBTENER TODAS LAS PUBLICACIONES (Para el inicio)
@app.get("/api/publicaciones")
def obtener_publicaciones(
    consulta: str | None = Query(None, max_length=250),
    precio_min: Decimal | None = Query(None, ge=0, max_digits=14, decimal_places=2),
    precio_max: Decimal | None = Query(None, ge=0, max_digits=14, decimal_places=2),
    cupos_min: int | None = Query(None, ge=1, le=2147483647),
    categoria: Literal["busco", "ofrezco"] | None = Query(None),
    tipo_vivienda: Literal["casa", "departamento", "habitacion"] | None = Query(None),
    mascota: Literal["si", "no"] | None = Query(None),
):
    condiciones = []
    parametros = []
    if consulta and consulta.strip():
        condiciones.append("(p.titulo ILIKE %s OR p.ubicacion ILIKE %s OR COALESCE(p.contenido, p.descripcion, '') ILIKE %s)")
        termino = f"%{consulta.strip()}%"
        parametros.extend([termino, termino, termino])
    if precio_min is not None:
        condiciones.append("p.precio >= %s")
        parametros.append(precio_min)
    if precio_max is not None:
        condiciones.append("p.precio <= %s")
        parametros.append(precio_max)
    if cupos_min is not None:
        condiciones.append("p.cupos_totales >= %s")
        parametros.append(cupos_min)
    if categoria is not None:
        condiciones.append("p.categoria = %s")
        parametros.append(categoria)
    if tipo_vivienda is not None:
        condiciones.append("p.tipo_vivienda = %s")
        parametros.append(tipo_vivienda)
    if mascota is not None:
        condiciones.append("p.mascota = %s")
        parametros.append(mascota)
    where = f"WHERE {' AND '.join(condiciones)}" if condiciones else ""
    try:
        with conectar() as conexion:
            registros = conexion.execute(f"""
                SELECT p.id_publicacion, p.titulo, p.precio, p.ubicacion, p.cupos_totales, 
                       p.tipo_vivienda,
                       (SELECT i.url FROM haycupo.imagen_publicacion i
                        WHERE i.id_publicacion = p.id_publicacion
                        ORDER BY i.orden, i.id_imagen LIMIT 1) as imagen_url,
                       p.categoria, p.descripcion, p.mascota, p.contenido
                FROM haycupo.publicacion p
                {where}
                ORDER BY p.id_publicacion DESC
            """, tuple(parametros)).fetchall()
            
            publicaciones = []
            for row in registros:
                desc_final = row[10] if row[10] else row[8]
                publicaciones.append({
                    "id": row[0], "titulo": row[1], "precio": float(row[2]), "ubicacion": row[3],
                    "cupos_totales": row[4], "tipo_vivienda": row[5], "imagen": row[6],
                    "categoria": row[7], "descripcion": desc_final, "mascota": row[9]
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
                SELECT p.id_publicacion, p.titulo, p.precio, p.estado, p.tipo_vivienda, p.ubicacion, p.cupos_totales, i.url
                FROM haycupo.publicacion p
                LEFT JOIN haycupo.imagen_publicacion i ON p.id_publicacion = i.id_publicacion
                WHERE p.id_usuario = %s
                ORDER BY p.id_publicacion DESC
            """, (id_usuario,)).fetchall()
            
            return [{"id": r[0], "titulo": r[1], "precio": float(r[2]), "estado": r[3], "tipo": r[4], "ubicacion": r[5], "cupos": r[6], "imagen": r[7]} for r in registros]
    except Exception:
        raise HTTPException(status_code=500, detail="Error al cargar tus publicaciones")


# OBTENER UNA SOLA PUBLICACIÓN (Para rellenar el formulario al editar)
@app.get("/api/publicaciones/{id_pub}")
def obtener_una_publicacion(id_pub: int, id_usuario: int = Depends(get_current_user)):
    with conectar() as conexion:
        r = conexion.execute("""
            SELECT titulo, categoria, tipo_vivienda, ubicacion, precio, cupos_totales, mascota, descripcion 
            FROM haycupo.publicacion WHERE id_publicacion = %s AND id_usuario = %s
        """, (id_pub, id_usuario)).fetchone()
        
        if r:
            return {
                "titulo": r[0], "categoria": r[1], "tipo_vivienda": r[2], 
                "ubicacion": r[3], "precio": r[4], "cupos_totales": r[5], 
                "mascota": r[6], "descripcion": r[7]
            }
        raise HTTPException(status_code=404, detail="Publicación no encontrada")


# CREAR PUBLICACIÓN NUEVA
@app.post("/api/publicaciones", status_code=201)
def crear_publicacion(
    titulo: Annotated[str, Form(min_length=1, max_length=200)],
    categoria: Annotated[Literal["busco", "ofrezco"], Form()],
    ubicacion: Annotated[str, Form(min_length=1, max_length=250)],
    precio: Annotated[Decimal, Form(ge=0, max_digits=14, decimal_places=2)],
    tipo: Annotated[Literal["Arrendador", "Compartida"], Form()],
    cupos_totales: Annotated[int, Form(ge=1, le=2147483647)],
    tipo_vivienda: Annotated[Literal["casa", "departamento", "habitacion"], Form()],
    descripcion: Annotated[str, Form(min_length=1, max_length=5000)],
    mascota: Annotated[str, Form()] = "no",
    permitir_comentarios: Annotated[str, Form()] = "false",
    imagen: Annotated[UploadFile | None, File()] = None,
    id_usuario: int = Depends(get_current_user)
):
    texto_desc = descripcion.strip()
    permitir = True if permitir_comentarios.lower() == "true" else False

    if not all([titulo.strip(), ubicacion.strip(), texto_desc]):
        raise HTTPException(status_code=422, detail="Completa el título, ubicación y descripción.")

    nombre_imagen = None
    ruta_imagen = None

    if imagen and imagen.filename:
        limite = 5 * 1024 * 1024
        contenido_img = imagen.file.read(limite + 1)
        if len(contenido_img) > limite:
            raise HTTPException(status_code=413, detail="La imagen debe pesar como máximo 5 MB.")
        try:
            with Image.open(BytesIO(contenido_img)) as foto:
                extensiones = {"JPEG": ".jpg", "PNG": ".png", "WEBP": ".webp"}
                extension = extensiones.get(foto.format)
                if not extension:
                    raise HTTPException(status_code=422, detail="Usa una imagen JPG, PNG o WEBP.")
                foto.verify()
        except Exception:
            raise HTTPException(status_code=422, detail="El archivo no es válido.") from None

        nombre_imagen = uuid4().hex + extension
        ruta_imagen = IMAGENES / nombre_imagen

    try:
        with conectar() as conexion:
            fila = conexion.execute(
                """
                INSERT INTO haycupo.publicacion (
                    id_usuario, tipo, titulo, descripcion, precio, ubicacion,
                    estado, cupos_totales, categoria, tipo_vivienda,
                    permitir_comentarios, mascota, contenido
                )
                VALUES (%s, %s, %s, %s, %s, %s, 'Disponible', %s, %s, %s, %s, %s, %s)
                RETURNING id_publicacion
                """,
                (id_usuario, tipo, titulo, texto_desc, precio, ubicacion,
                 cupos_totales, categoria, tipo_vivienda, permitir, mascota, texto_desc),
            ).fetchone()
            
            identificador = fila[0]

            if ruta_imagen:
                ruta_imagen.write_bytes(contenido_img)
                conexion.execute(
                    "INSERT INTO haycupo.imagen_publicacion (id_publicacion, url, orden) VALUES (%s, %s, 0)",
                    (identificador, f"/imagenes/{nombre_imagen}")
                )
    except Exception:
        if ruta_imagen:
            ruta_imagen.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail="Error al guardar.") from None

    return {"id": identificador, "mensaje": "Publicación creada"}


# ACTUALIZAR UNA PUBLICACIÓN EXISTENTE
@app.put("/api/publicaciones/{id_pub}")
def actualizar_publicacion(
    id_pub: int,
    titulo: Annotated[str, Form()], 
    categoria: Annotated[str, Form()],
    ubicacion: Annotated[str, Form()], 
    precio: Annotated[Decimal, Form()],
    tipo_vivienda: Annotated[str, Form()], 
    descripcion: Annotated[str, Form()],
    tipo: Annotated[str, Form()],
    cupos_totales: Annotated[int, Form()], 
    mascota: Annotated[str, Form()] = "no",
    permitir_comentarios: Annotated[str, Form()] = "false",
    imagen: Annotated[UploadFile | None, File()] = None,
    id_usuario: int = Depends(get_current_user)
):
    try:
        with conectar() as conexion:
            updated = conexion.execute("""
                UPDATE haycupo.publicacion 
                SET titulo=%s, categoria=%s, ubicacion=%s, precio=%s, 
                    tipo_vivienda=%s, descripcion=%s, cupos_totales=%s, mascota=%s, contenido=%s
                WHERE id_publicacion=%s AND id_usuario=%s
            """, (titulo, categoria, ubicacion, precio, tipo_vivienda, descripcion, cupos_totales, mascota, descripcion, id_pub, id_usuario))
            if updated.rowcount == 0:
                raise HTTPException(404, "Publicación no encontrada o sin permiso.")
        return {"mensaje": "Publicación actualizada correctamente"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="No se pudo actualizar la base de datos")


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
