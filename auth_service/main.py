import os
from datetime import date
from fastapi import APIRouter, FastAPI, HTTPException, Response, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
import psycopg

auth_router = APIRouter()

app = FastAPI(title="Auth Service - Roomies")

# IMPORTANTE: allow_credentials=True es obligatorio para que las Cookies funcionen
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True, 
    allow_methods=["*"],
    allow_headers=["*"],
)

EDAD_MINIMA = 18

# Mima conexión directa a tu base de datos que usa tu main principal
DB_URL = "postgresql://postgres.erefnpvdjondjpcyjrpb:Hcupo2223xd@aws-0-sa-east-1.pooler.supabase.com:6543/postgres"

def conectar():
    return psycopg.connect(DB_URL, connect_timeout=10)


class RegistroRequest(BaseModel):
    nombre: str
    correo: EmailStr
    contrasena: str
    fecha_nacimiento: date

def calcular_edad(fecha_nacimiento: date) -> int:
    hoy = date.today()
    edad = hoy.year - fecha_nacimiento.year
    if (hoy.month, hoy.day) < (fecha_nacimiento.month, fecha_nacimiento.day):
        edad -= 1
    return edad


@auth_router.post("/auth/registro")
def registrar_usuario(datos: RegistroRequest, response: Response):
    edad = calcular_edad(datos.fecha_nacimiento)
    if edad < EDAD_MINIMA:
        raise HTTPException(
            status_code=400,
            detail=f"Debes tener al menos {EDAD_MINIMA} años para registrarte.",
        )

    if len(datos.contrasena) < 6:
        raise HTTPException(
            status_code=400,
            detail="La contraseña debe tener al menos 6 caracteres.",
        )

    try:
        with conectar() as conexion:
            # 1. Verificar si el correo ya existe
            existe = conexion.execute(
                "SELECT id_usuario FROM haycupo.usuario WHERE correo = %s", 
                (datos.correo,)
            ).fetchone()
            
            if existe:
                raise HTTPException(status_code=409, detail="Ya existe una cuenta con ese correo.")
            
            # 2. Crear usuario directamente en haycupo.usuario
            nuevo_id = conexion.execute(
                """
                INSERT INTO haycupo.usuario (nombre, correo, contrasena, fecha_nacimiento) 
                VALUES (%s, %s, %s, %s) RETURNING id_usuario
                """,
                (datos.nombre, datos.correo, datos.contrasena, datos.fecha_nacimiento.isoformat())
            ).fetchone()[0]
            
            # 3. Guardar la cookie de sesión en el navegador
            response.set_cookie(key="roomies_id", value=str(nuevo_id), httponly=True, path="/")
            
            return {
                "success": True,
                "user": {
                    "id": nuevo_id,
                    "nombre": datos.nombre,
                    "correo": datos.correo,
                },
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error al registrar: {str(e)}")


class LoginRequest(BaseModel):
    correo: EmailStr
    contrasena: str


@auth_router.post("/auth/login")
def iniciar_sesion(datos: LoginRequest, response: Response):
    try:
        with conectar() as conexion:
            # Buscar coincidencia exacta de correo y contraseña en tu esquema
            usuario = conexion.execute(
                "SELECT id_usuario, nombre FROM haycupo.usuario WHERE correo = %s AND contrasena = %s",
                (datos.correo, datos.contrasena)
            ).fetchone()
            
            if not usuario:
                raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos.")
            
            # Guardar la cookie de sesión en el navegador
            response.set_cookie(key="roomies_id", value=str(usuario[0]), httponly=True, path="/")
            
            return {
                "success": True,
                "user": {
                    "id": usuario[0],
                    "nombre": usuario[1],
                    "correo": datos.correo,
                },
                "access_token": "demo_cookie_token",
            }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail="Error en la base de datos al iniciar sesión.")


@auth_router.post("/auth/logout")
def cerrar_sesion(response: Response):
    # Eliminar la cookie para cerrar la sesión
    response.delete_cookie("roomies_id", path="/")
    return {"success": True}