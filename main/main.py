from fastapi.staticfiles import StaticFiles
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
from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile, Depends, Cookie
from match_conexion_service.routes import router as conexion_router

from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError
from auth_service.main import auth_router


# ==========================================
# 1. CONFIGURACIÓN DE CARPETAS
# ==========================================
BASE = Path(__file__).resolve().parent
FRONTEND_CREACION = BASE.parent / "Creacion_De_publicacion"
FRONTEND_PRINCIPAL = BASE.parent / "PaginaPrincipal"
IMAGENES = BASE / "imagenes"

IMAGENES.mkdir(parents=True, exist_ok=True)


# ==========================================
# 2. CONEXIÓN CON POSTGRESQL (SUPABASE)
# ==========================================
def conectar():
    url = "postgresql://postgres.erefnpvdjondjpcyjrpb:Hcupo2223xd@aws-0-sa-east-1.pooler.supabase.com:6543/postgres"
    return psycopg.connect(url, connect_timeout=10)


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
        conexion.execute("""
            CREATE TABLE IF NOT EXISTS haycupo.postulacion (
                id_postulacion BIGSERIAL PRIMARY KEY,
                id_publicacion BIGINT NOT NULL REFERENCES haycupo.publicacion(id_publicacion) ON DELETE CASCADE,
                id_usuario BIGINT NOT NULL REFERENCES haycupo.usuario(id_usuario) ON DELETE CASCADE,
                estado VARCHAR(20) NOT NULL DEFAULT 'Pendiente'
                    CHECK (estado IN ('Pendiente', 'Aceptada', 'Rechazada', 'Retirada')),
                fecha_postulacion TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                UNIQUE (id_publicacion, id_usuario)
            )
        """)
    yield


app = FastAPI(lifespan=lifespan)

# CONFIGURACIÓN DE CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(conexion_router)
app.include_router(auth_router)

# MONTAJE DE CARPETAS ESTÁTICAS
app.mount("/static_creacion", StaticFiles(directory=FRONTEND_CREACION), name="static_creacion")
app.mount("/static_principal", StaticFiles(directory=FRONTEND_PRINCIPAL), name="static_principal")
app.mount("/imagenes", StaticFiles(directory=IMAGENES), name="imagenes")
app.mount("/Iconos", StaticFiles(directory="Iconos"), name="iconos")
app.mount("/PerfilU", StaticFiles(directory="PerfilU"), name="perfil_u")


# Ahora lee la Cookie dinámica, pero si no hay, asume que es el usuario 1 para que no se caiga
def autor_de_prueba(roomies_id: str = Cookie(default="1")):
    return int(roomies_id)


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
    return FileResponse("PerfilU/perfil.html")

@app.get("/mis-publicaciones")
def mostrar_mis_publicaciones():
    # Carga tu CRUD
    return FileResponse(FRONTEND_PRINCIPAL / "PublicacionesU" / "mis_publicaciones.html")

@app.get("/mis-postulaciones")
def mostrar_mis_postulaciones():
    return FileResponse(FRONTEND_PRINCIPAL / "PublicacionesU" / "mis_postulaciones.html")

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
def obtener_publicaciones():
    try:
        with conectar() as conexion:
            registros = conexion.execute("""
                SELECT p.id_publicacion, p.titulo, p.precio, p.ubicacion, p.cupos_totales, 
                       p.tipo_vivienda, i.url as imagen_url, p.categoria, p.descripcion, p.mascota, p.contenido
                FROM haycupo.publicacion p
                LEFT JOIN haycupo.imagen_publicacion i ON p.id_publicacion = i.id_publicacion
                ORDER BY p.id_publicacion DESC
            """).fetchall()
            
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
def obtener_mis_publicaciones(id_usuario: int = Depends(autor_de_prueba)):
    try:
        with conectar() as conexion:
            registros = conexion.execute("""
                SELECT p.id_publicacion, p.titulo, p.precio, p.estado, p.tipo_vivienda, p.ubicacion,
                       p.cupos_totales, i.url, COUNT(post.id_postulacion) AS postulaciones
                FROM haycupo.publicacion p
                LEFT JOIN LATERAL (
                    SELECT url FROM haycupo.imagen_publicacion
                    WHERE id_publicacion = p.id_publicacion
                    ORDER BY orden LIMIT 1
                ) i ON TRUE
                LEFT JOIN haycupo.postulacion post
                    ON post.id_publicacion = p.id_publicacion AND post.estado != 'Retirada'
                WHERE p.id_usuario = %s
                GROUP BY p.id_publicacion, i.url
                ORDER BY p.id_publicacion DESC
            """, (id_usuario,)).fetchall()
            
            return [{"id": r[0], "titulo": r[1], "precio": float(r[2]), "estado": r[3], "tipo": r[4], "ubicacion": r[5], "cupos": r[6], "imagen": r[7], "postulaciones": r[8]} for r in registros]
    except Exception:
        raise HTTPException(status_code=500, detail="Error al cargar tus publicaciones")


# OBTENER UNA SOLA PUBLICACIÓN (Para rellenar el formulario al editar)
@app.get("/api/publicaciones/{id_pub}")
def obtener_una_publicacion(id_pub: int, id_usuario: int = Depends(autor_de_prueba)):
    try:
        with conectar() as conexion:
            r = conexion.execute("""
                SELECT titulo, categoria, tipo_vivienda, ubicacion, precio, cupos_totales, mascota, descripcion
                FROM haycupo.publicacion WHERE id_publicacion = %s AND id_usuario = %s
            """, (id_pub, id_usuario)).fetchone()

            if not r:
                raise HTTPException(status_code=404, detail="Publicación no encontrada")
            return {
                "titulo": r[0], "categoria": r[1], "tipo_vivienda": r[2],
                "ubicacion": r[3], "precio": r[4], "cupos_totales": r[5],
                "mascota": r[6], "descripcion": r[7]
            }
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Error al cargar la publicación") from None


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
    id_usuario: int = Depends(autor_de_prueba)
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
    titulo: Annotated[str, Form(min_length=1, max_length=200)],
    categoria: Annotated[Literal["busco", "ofrezco"], Form()],
    ubicacion: Annotated[str, Form(min_length=1, max_length=250)],
    precio: Annotated[Decimal, Form(ge=0, max_digits=14, decimal_places=2)],
    tipo_vivienda: Annotated[Literal["casa", "departamento", "habitacion"], Form()],
    descripcion: Annotated[str, Form(min_length=1, max_length=5000)],
    tipo: Annotated[Literal["Arrendador", "Compartida"], Form()],
    cupos_totales: Annotated[int, Form(ge=1, le=2147483647)],
    mascota: Annotated[str, Form()] = "no",
    permitir_comentarios: Annotated[str, Form()] = "false",
    imagen: Annotated[UploadFile | None, File()] = None,
    id_usuario: int = Depends(autor_de_prueba)
):
    texto_desc = descripcion.strip()
    if not all([titulo.strip(), ubicacion.strip(), texto_desc]):
        raise HTTPException(status_code=422, detail="Completa el título, ubicación y descripción.")

    ruta_imagen = None
    contenido_img = None
    nombre_imagen = None
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
        except HTTPException:
            raise
        except (UnidentifiedImageError, OSError):
            raise HTTPException(status_code=422, detail="El archivo no es válido.") from None

        nombre_imagen = uuid4().hex + extension
        ruta_imagen = IMAGENES / nombre_imagen

    try:
        with conectar() as conexion:
            publicacion = conexion.execute("""
                UPDATE haycupo.publicacion 
                SET titulo=%s, categoria=%s, tipo=%s, ubicacion=%s, precio=%s,
                    tipo_vivienda=%s, descripcion=%s, cupos_totales=%s, mascota=%s,
                    permitir_comentarios=%s, contenido=%s
                WHERE id_publicacion=%s AND id_usuario=%s
                RETURNING id_publicacion
            """, (
                titulo, categoria, tipo, ubicacion, precio, tipo_vivienda, texto_desc,
                cupos_totales, mascota, permitir_comentarios.lower() == "true",
                texto_desc, id_pub, id_usuario,
            )).fetchone()
            if not publicacion:
                raise HTTPException(status_code=404, detail="Publicación no encontrada")

            if ruta_imagen and nombre_imagen and contenido_img:
                ruta_imagen.write_bytes(contenido_img)
                conexion.execute("DELETE FROM haycupo.imagen_publicacion WHERE id_publicacion = %s", (id_pub,))
                conexion.execute(
                    "INSERT INTO haycupo.imagen_publicacion (id_publicacion, url, orden) VALUES (%s, %s, 0)",
                    (id_pub, f"/imagenes/{nombre_imagen}")
                )
        return {"mensaje": "Publicación actualizada correctamente"}
    except HTTPException:
        if ruta_imagen:
            ruta_imagen.unlink(missing_ok=True)
        raise
    except Exception:
        if ruta_imagen:
            ruta_imagen.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail="No se pudo actualizar la base de datos") from None


# ELIMINAR UNA PUBLICACIÓN
@app.delete("/api/publicaciones/{id_pub}")
def borrar_publicacion(id_pub: int, id_usuario: int = Depends(autor_de_prueba)):
    try:
        with conectar() as conexion:
            imagenes = conexion.execute(
                "SELECT url FROM haycupo.imagen_publicacion WHERE id_publicacion = %s AND EXISTS (SELECT 1 FROM haycupo.publicacion WHERE id_publicacion = %s AND id_usuario = %s)",
                (id_pub, id_pub, id_usuario),
            ).fetchall()
            eliminada = conexion.execute(
                "DELETE FROM haycupo.publicacion WHERE id_publicacion = %s AND id_usuario = %s RETURNING id_publicacion",
                (id_pub, id_usuario),
            ).fetchone()
            if not eliminada:
                raise HTTPException(status_code=404, detail="Publicación no encontrada")
            conexion.execute("DELETE FROM haycupo.imagen_publicacion WHERE id_publicacion = %s", (id_pub,))
        for (url,) in imagenes:
            if url and url.startswith("/imagenes/"):
                (IMAGENES / Path(url).name).unlink(missing_ok=True)
        return {"mensaje": "Publicación eliminada"}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Error al eliminar") from None


@app.post("/api/publicaciones/{id_pub}/postulaciones", status_code=201)
def postular_a_publicacion(id_pub: int, id_usuario: int = Depends(autor_de_prueba)):
    try:
        with conectar() as conexion:
            publicacion = conexion.execute(
                "SELECT id_usuario FROM haycupo.publicacion WHERE id_publicacion = %s",
                (id_pub,),
            ).fetchone()
            if not publicacion:
                raise HTTPException(status_code=404, detail="Publicación no encontrada")
            if publicacion[0] == id_usuario:
                raise HTTPException(status_code=400, detail="No puedes postular a tu propia publicación.")
            postulacion = conexion.execute("""
                INSERT INTO haycupo.postulacion (id_publicacion, id_usuario)
                VALUES (%s, %s)
                ON CONFLICT (id_publicacion, id_usuario) DO UPDATE
                    SET estado = 'Pendiente', fecha_postulacion = NOW()
                    WHERE haycupo.postulacion.estado = 'Retirada'
                RETURNING id_postulacion
            """, (id_pub, id_usuario)).fetchone()
            if not postulacion:
                raise HTTPException(status_code=409, detail="Ya postulaste a esta publicación.")
        return {"mensaje": "Postulación enviada"}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="No se pudo enviar la postulación") from None


@app.get("/api/mis-postulaciones")
def obtener_mis_postulaciones(id_usuario: int = Depends(autor_de_prueba)):
    try:
        with conectar() as conexion:
            registros = conexion.execute("""
                SELECT post.id_postulacion, post.estado, post.fecha_postulacion,
                       p.id_publicacion, p.titulo, p.ubicacion, p.precio,
                       usuario.nombre
                FROM haycupo.postulacion post
                JOIN haycupo.publicacion p ON p.id_publicacion = post.id_publicacion
                JOIN haycupo.usuario usuario ON usuario.id_usuario = p.id_usuario
                WHERE post.id_usuario = %s
                ORDER BY post.fecha_postulacion DESC
            """, (id_usuario,)).fetchall()
            return [{
                "id": r[0], "estado": r[1], "fecha": r[2].isoformat(),
                "publicacion_id": r[3], "titulo": r[4], "ubicacion": r[5],
                "precio": float(r[6]), "publicador": r[7],
            } for r in registros]
    except Exception:
        raise HTTPException(status_code=500, detail="Error al cargar tus postulaciones") from None


@app.get("/api/publicaciones/{id_pub}/postulaciones")
def obtener_postulaciones_publicacion(id_pub: int, id_usuario: int = Depends(autor_de_prueba)):
    try:
        with conectar() as conexion:
            es_propietario = conexion.execute(
                "SELECT 1 FROM haycupo.publicacion WHERE id_publicacion = %s AND id_usuario = %s",
                (id_pub, id_usuario),
            ).fetchone()
            if not es_propietario:
                raise HTTPException(status_code=404, detail="Publicación no encontrada")
            registros = conexion.execute("""
                SELECT post.id_postulacion, post.estado, post.fecha_postulacion,
                       usuario.nombre, usuario.correo
                FROM haycupo.postulacion post
                JOIN haycupo.usuario usuario ON usuario.id_usuario = post.id_usuario
                WHERE post.id_publicacion = %s AND post.estado != 'Retirada'
                ORDER BY post.fecha_postulacion DESC
            """, (id_pub,)).fetchall()
            return [{
                "id": r[0], "estado": r[1], "fecha": r[2].isoformat(),
                "nombre": r[3] or "Usuario", "correo": r[4],
            } for r in registros]
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Error al cargar las postulaciones") from None


@app.put("/api/postulaciones/{id_postulacion}")
def responder_postulacion(
    id_postulacion: int,
    estado: Annotated[Literal["Aceptada", "Rechazada"], Form()],
    id_usuario: int = Depends(autor_de_prueba),
):
    try:
        with conectar() as conexion:
            postulacion = conexion.execute("""
                UPDATE haycupo.postulacion post
                SET estado = %s
                FROM haycupo.publicacion p
                WHERE post.id_postulacion = %s
                    AND post.id_publicacion = p.id_publicacion
                    AND p.id_usuario = %s
                    AND post.estado = 'Pendiente'
                RETURNING post.id_postulacion
            """, (estado, id_postulacion, id_usuario)).fetchone()
            if not postulacion:
                raise HTTPException(status_code=404, detail="Postulación pendiente no encontrada")
        return {"mensaje": f"Postulación {estado.lower()}"}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="No se pudo responder la postulación") from None


@app.delete("/api/postulaciones/{id_postulacion}")
def retirar_postulacion(id_postulacion: int, id_usuario: int = Depends(autor_de_prueba)):
    try:
        with conectar() as conexion:
            retirada = conexion.execute("""
                UPDATE haycupo.postulacion
                SET estado = 'Retirada'
                WHERE id_postulacion = %s AND id_usuario = %s AND estado = 'Pendiente'
                RETURNING id_postulacion
            """, (id_postulacion, id_usuario)).fetchone()
            if not retirada:
                raise HTTPException(status_code=404, detail="Postulación pendiente no encontrada")
        return {"mensaje": "Postulación retirada"}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="No se pudo retirar la postulación") from None


# OBTENER DATOS DEL PERFIL
@app.get("/api/perfil")
def obtener_perfil(id_usuario: int = Depends(autor_de_prueba)):
    try:
        with conectar() as conexion:
            user = conexion.execute("SELECT nombre, edad, ocupacion, ciudad, breve_descripcion, sobre_mi, foto_perfil FROM haycupo.usuario WHERE id_usuario = %s", (id_usuario,)).fetchone()
            pubs = conexion.execute("SELECT COUNT(*) FROM haycupo.publicacion WHERE id_usuario = %s", (id_usuario,)).fetchone()[0]
            
            if not user:
                raise HTTPException(status_code=404, detail="Usuario no encontrado")
                
            return {
                "nombre": user[0] or "Usuario", 
                "edad": user[1] or "", 
                "ocupacion": user[2] or "",
                "ciudad": user[3] or "", 
                "breve_descripcion": user[4] or "Aún no hay una descripción breve.",
                "sobre_mi": user[5] or "No hay detalles adicionales.",
                "foto_perfil": user[6] or None, 
                "total_publicaciones": pubs
            }
    except Exception:
        raise HTTPException(status_code=500, detail="Error al cargar el perfil")

# GUARDAR EDICIÓN DE PERFIL
@app.put("/api/perfil")
def actualizar_perfil(
    edad: Annotated[str, Form()] = "", ocupacion: Annotated[str, Form()] = "",
    ciudad: Annotated[str, Form()] = "", breve_descripcion: Annotated[str, Form()] = "",
    sobre_mi: Annotated[str, Form()] = "", foto: Annotated[UploadFile | None, File()] = None,
    id_usuario: int = Depends(autor_de_prueba)
):
    url_foto = None

    if foto and foto.filename:
        contenido_img = foto.file.read(5 * 1024 * 1024)
        nombre_imagen = uuid4().hex + ".png"
        ruta_foto = IMAGENES / nombre_imagen
        ruta_foto.write_bytes(contenido_img)
        url_foto = f"/imagenes/{nombre_imagen}"

    try:
        with conectar() as conexion:
            if url_foto:
                conexion.execute("UPDATE haycupo.usuario SET edad=%s, ocupacion=%s, ciudad=%s, breve_descripcion=%s, sobre_mi=%s, foto_perfil=%s WHERE id_usuario=%s", 
                                 (edad, ocupacion, ciudad, breve_descripcion, sobre_mi, url_foto, id_usuario))
            else:
                conexion.execute("UPDATE haycupo.usuario SET edad=%s, ocupacion=%s, ciudad=%s, breve_descripcion=%s, sobre_mi=%s WHERE id_usuario=%s", 
                                 (edad, ocupacion, ciudad, breve_descripcion, sobre_mi, id_usuario))
        return {"mensaje": "Perfil actualizado permanentemente"}
    except Exception:
        raise HTTPException(status_code=500, detail="Error al guardar en la base de datos")