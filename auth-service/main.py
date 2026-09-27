import os
from datetime import date
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

supabase_admin: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)

app = FastAPI(title="Auth Service - Roomies")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)

EDAD_MINIMA = 18


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


@app.get("/")
def inicio():
    return {"message": "Auth service de Roomies funcionando"}


@app.post("/auth/registro")
def registrar_usuario(datos: RegistroRequest):
    # 1. Validar mayoría de edad (FR-05, BR-01 del SRS)
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

    # 2. Crear el usuario en Supabase Auth (correo + contraseña)
    try:
        resultado = supabase_admin.auth.admin.create_user({
            "email": datos.correo,
            "password": datos.contrasena,
            "email_confirm": True,
        })
    except Exception as e:
        mensaje = str(e)
        if "already" in mensaje.lower() or "duplicate" in mensaje.lower():
            raise HTTPException(status_code=409, detail="Ya existe una cuenta con ese correo.")
        raise HTTPException(status_code=500, detail=f"Error al crear el usuario: {mensaje}")

    usuario_id = resultado.user.id

    # 3. Crear la fila de perfil extendido, vinculada a ese usuario
    try:
        supabase_admin.table("perfiles").insert({
            "id": usuario_id,
            "nombre": datos.nombre,
            "fecha_nacimiento": datos.fecha_nacimiento.isoformat(),
        }).execute()
    except Exception as e:
        # Si falla el perfil, eliminamos el usuario para no dejar datos huérfanos
        supabase_admin.auth.admin.delete_user(usuario_id)
        raise HTTPException(status_code=500, detail=f"Error al crear el perfil: {str(e)}")

    return {
        "success": True,
        "user": {
            "id": usuario_id,
            "nombre": datos.nombre,
            "correo": datos.correo,
        },
    }