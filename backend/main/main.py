from fastapi.staticfiles import StaticFiles
import os
from contextlib import asynccontextmanager
from pathlib import Path
from typing import Annotated
from uuid import uuid4
from dotenv import load_dotenv

import psycopg
from fastapi import FastAPI, File, Form, HTTPException, UploadFile, Depends
from backend.match_conexion_service.routes import router as conexion_router
from backend.main.routes.ubicaciones import router as ubicaciones_router
from backend.main.routes.publicaciones import router as publicaciones_router
from backend.auth_service.main import auth_router
from backend.auth_service.security import get_current_user
from backend.auth_service.config import get_settings

from fastapi.responses import FileResponse
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

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


app.state.conectar = lambda: conectar()
app.state.obtener_imagenes = lambda: IMAGENES


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
app.include_router(ubicaciones_router)
app.include_router(publicaciones_router)
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
# OBTENER DATOS DEL PERFIL
@app.get("/api/perfil")
def obtener_perfil(id_usuario: int = Depends(get_current_user)):
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
