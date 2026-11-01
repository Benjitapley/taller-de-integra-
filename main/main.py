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
from dotenv import load_dotenv
from pydantic import ValidationError
from fastapi import FastAPI, File, Form, HTTPException, Query, UploadFile, Depends, Cookie
from match_conexion_service.routes import router as conexion_router
from publicaciones_service.schemas import (
    PublicacionCreada,
    PublicacionResumen,
    preferencias_desde_formulario,
)

from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image, UnidentifiedImageError
from auth_service.main import auth_router

load_dotenv()


# ==========================================
# 1. CONFIGURACIÓN DE CARPETAS
# ==========================================
BASE = Path(__file__).resolve().parent
FRONTEND_CREACION = BASE.parent / "Creacion_De_publicacion"
FRONTEND_PRINCIPAL = BASE.parent / "PaginaPrincipal"
IMAGENES = BASE / "imagenes"

IMAGENES.mkdir(parents=True, exist_ok=True)


# ==========================================
# 2. CONEXIÓN CON POSTGRESQL
# ==========================================
def conectar():
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("Falta configurar DATABASE_URL.")
    return psycopg.connect(url, connect_timeout=10)


@asynccontextmanager
async def lifespan(app: FastAPI):
    with conectar() as conexion:
        conexion.execute("""
            SELECT id_publicacion, id_usuario, tipo, titulo, descripcion,
                   precio, ubicacion, estado, cupos_totales,
                   categoria, tipo_vivienda, permitir_comentarios,
                   tipos_mascotas_aceptadas, condiciones_mascotas
            FROM haycupo.publicacion LIMIT 0
        """)
        conexion.execute("SELECT id_imagen, id_publicacion, url, orden FROM haycupo.imagen_publicacion LIMIT 0")
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
    try:
        identificador = int(roomies_id)
    except ValueError:
        raise HTTPException(status_code=401, detail="Inicia sesión para continuar.") from None
    if identificador < 1:
        raise HTTPException(status_code=401, detail="Inicia sesión para continuar.")
    return identificador


def validar_mascotas(mascota, tipos_json, condiciones, anteriores=None):
    try:
        return preferencias_desde_formulario(mascota, tipos_json, condiciones, anteriores)
    except ValidationError as error:
        mensaje = error.errors()[0]["msg"].removeprefix("Value error, ")
        raise HTTPException(status_code=422, detail=mensaje) from None
    except ValueError as error:
        raise HTTPException(status_code=422, detail=str(error)) from None


def resumen_cupos(identificador, estado, total):
    if estado is None:
        estado = "Disponible"
    return {
        "id": identificador,
        "estado": estado,
        "cupos_totales": total,
        "cupos_disponibles": 0 if estado.lower() == "cerrada" else total,
    }


def preparar_imagen(imagen):
    if not imagen or not imagen.filename:
        return None, None
    limite = 5 * 1024 * 1024
    contenido = imagen.file.read(limite + 1)
    if len(contenido) > limite:
        raise HTTPException(status_code=413, detail="La imagen debe pesar como máximo 5 MB.")
    try:
        with Image.open(BytesIO(contenido)) as foto:
            extension = {"JPEG": ".jpg", "PNG": ".png", "WEBP": ".webp"}.get(foto.format)
            if not extension:
                raise ValueError("Formato no permitido")
            foto.verify()
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError, Image.DecompressionBombError):
        raise HTTPException(status_code=422, detail="El archivo no es válido. Usa JPG, PNG o WEBP.") from None
    return IMAGENES / (uuid4().hex + extension), contenido


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
    limite: Annotated[int | None, Query(ge=1, le=100, description="Máximo de resultados; omitir para listar todos")] = None,
    offset: Annotated[int, Query(ge=0, le=9223372036854775807, description="Resultados a omitir para paginar")] = 0,
):
    if precio_min is not None and precio_max is not None and precio_min > precio_max:
        raise HTTPException(status_code=422, detail="El precio mínimo no puede superar al máximo.")

    filtros = ["LOWER(COALESCE(p.estado, 'Disponible')) <> 'cerrada'"]
    parametros = []
    if consulta and consulta.strip():
        # %, _ y la barra se buscan como texto, no como comodines de LIKE.
        ubicacion = consulta.strip().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        filtros.append("p.ubicacion ILIKE %s")
        parametros.append(f"%{ubicacion}%")
    if personas is not None:
        filtros.append("p.cupos_totales >= %s" if personas == "3" else "p.cupos_totales = %s")
        parametros.append(int(personas))
    if tipo is not None:
        filtros.append("p.tipo_vivienda = %s")
        parametros.append(tipo)
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

    sql = """
        SELECT p.id_publicacion, p.titulo, p.precio, p.ubicacion, p.cupos_totales,
               p.tipo_vivienda,
               (SELECT i.url FROM haycupo.imagen_publicacion i
                WHERE i.id_publicacion = p.id_publicacion
                ORDER BY i.orden, i.id_imagen LIMIT 1) AS imagen_url,
               p.categoria, p.descripcion, p.mascota, p.contenido,
               p.tipos_mascotas_aceptadas, p.condiciones_mascotas, p.estado
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
                desc_final = row[10] if row[10] else row[8]
                publicaciones.append({
                    **resumen_cupos(row[0], row[13], row[4]),
                    "titulo": row[1], "precio": float(row[2]), "ubicacion": row[3],
                    "tipo_vivienda": row[5], "imagen": row[6],
                    "categoria": row[7], "descripcion": desc_final, "mascota": row[9],
                    "tipos_mascotas_aceptadas": row[11] or [],
                    "condiciones_mascotas": row[12],
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
def obtener_una_publicacion(id_pub: int):
    try:
        with conectar() as conexion:
            r = conexion.execute("""
                SELECT p.titulo, p.categoria, p.tipo_vivienda, p.ubicacion, p.precio, p.cupos_totales,
                       p.mascota, COALESCE(NULLIF(p.contenido, ''), p.descripcion),
                       p.tipos_mascotas_aceptadas, p.condiciones_mascotas,
                       p.estado, p.tipo, p.permitir_comentarios,
                       (SELECT i.url FROM haycupo.imagen_publicacion i
                        WHERE i.id_publicacion = p.id_publicacion
                        ORDER BY i.orden, i.id_imagen LIMIT 1)
                FROM haycupo.publicacion p WHERE p.id_publicacion = %s
            """, (id_pub,)).fetchone()
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
def cerrar_publicacion(id_pub: int, id_usuario: int = Depends(autor_de_prueba)):
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
    mascota: Annotated[str, Form()] = "no",
    tipos_mascotas_aceptadas: Annotated[str | None, Form(max_length=1000)] = None,
    condiciones_mascotas: Annotated[str | None, Form(max_length=2000)] = None,
    permitir_comentarios: Annotated[bool, Form()] = False,
    imagen: Annotated[UploadFile | None, File()] = None,
    id_usuario: int = Depends(autor_de_prueba)
):
    titulo = titulo.strip()
    ubicacion = ubicacion.strip()
    texto_desc = descripcion.strip()
    permitir = permitir_comentarios

    if not all([titulo.strip(), ubicacion.strip(), texto_desc]):
        raise HTTPException(status_code=422, detail="Completa el título, ubicación y descripción.")

    preferencias = validar_mascotas(mascota, tipos_mascotas_aceptadas, condiciones_mascotas)

    ruta_imagen, contenido_img = preparar_imagen(imagen)

    try:
        with conectar() as conexion:
            fila = conexion.execute(
                """
                INSERT INTO haycupo.publicacion (
                    id_usuario, tipo, titulo, descripcion, precio, ubicacion,
                    estado, cupos_totales, categoria, tipo_vivienda,
                    permitir_comentarios, mascota, contenido,
                    tipos_mascotas_aceptadas, condiciones_mascotas
                )
                VALUES (%s, %s, %s, %s, %s, %s, 'Disponible', %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id_publicacion
                """,
                (id_usuario, tipo, titulo, texto_desc, precio, ubicacion,
                 cupos_totales, categoria, tipo_vivienda, permitir, preferencias.mascota, texto_desc,
                 preferencias.tipos_mascotas_aceptadas, preferencias.condiciones_mascotas),
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
    mascota: Annotated[str, Form()] = "no",
    tipos_mascotas_aceptadas: Annotated[str | None, Form(max_length=1000)] = None,
    condiciones_mascotas: Annotated[str | None, Form(max_length=2000)] = None,
    permitir_comentarios: Annotated[bool | None, Form()] = None,
    imagen: Annotated[UploadFile | None, File()] = None,
    id_usuario: int = Depends(autor_de_prueba)
):
    titulo, ubicacion, descripcion = titulo.strip(), ubicacion.strip(), descripcion.strip()
    if not all([titulo, ubicacion, descripcion]):
        raise HTTPException(status_code=422, detail="Completa el título, ubicación y descripción.")
    ruta_imagen, contenido_img = preparar_imagen(imagen)
    imagen_escrita = False
    try:
        with conectar() as conexion:
            anterior = conexion.execute("""
                SELECT mascota, tipos_mascotas_aceptadas, condiciones_mascotas
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
            conexion.execute("""
                UPDATE haycupo.publicacion 
                SET titulo=%s, categoria=%s, ubicacion=%s, precio=%s, 
                    tipo_vivienda=%s, descripcion=%s, cupos_totales=%s, mascota=%s, contenido=%s,
                    tipos_mascotas_aceptadas=%s, condiciones_mascotas=%s,
                    tipo=COALESCE(%s, tipo), permitir_comentarios=COALESCE(%s, permitir_comentarios)
                WHERE id_publicacion=%s AND id_usuario=%s
            """, (titulo, categoria, ubicacion, precio, tipo_vivienda, descripcion, cupos_totales,
                  preferencias.mascota, descripcion, preferencias.tipos_mascotas_aceptadas,
                  preferencias.condiciones_mascotas, tipo, permitir_comentarios, id_pub, id_usuario))
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
def borrar_publicacion(id_pub: int, id_usuario: int = Depends(autor_de_prueba)):
    try:
        with conectar() as conexion:
            propia = conexion.execute("""
                SELECT id_publicacion FROM haycupo.publicacion
                WHERE id_publicacion = %s AND id_usuario = %s FOR UPDATE
            """, (id_pub, id_usuario)).fetchone()
            if propia is None:
                raise HTTPException(status_code=404, detail="Publicación no encontrada")
            conexion.execute("DELETE FROM haycupo.imagen_publicacion WHERE id_publicacion = %s", (id_pub,))
            conexion.execute("DELETE FROM haycupo.publicacion WHERE id_publicacion = %s AND id_usuario = %s", (id_pub, id_usuario))
        return {"mensaje": "Publicación eliminada"}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=500, detail="Error al eliminar") from None


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
