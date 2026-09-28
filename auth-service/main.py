import os
from datetime import date
from fastapi import FastAPI, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from dotenv import load_dotenv
from supabase import create_client, Client


load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

supabase_admin: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
supabase_client: Client = create_client(SUPABASE_URL, SUPABASE_ANON_KEY)

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

    try:
        supabase_admin.table("perfiles").insert({
            "id": usuario_id,
            "nombre": datos.nombre,
            "fecha_nacimiento": datos.fecha_nacimiento.isoformat(),
        }).execute()
    except Exception as e:
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

class LoginRequest(BaseModel):
    correo: EmailStr
    contrasena: str


@app.post("/auth/login")
def iniciar_sesion(datos: LoginRequest):
    try:
        resultado = supabase_client.auth.sign_in_with_password({
            "email": datos.correo,
            "password": datos.contrasena,
        })
    except Exception:
        raise HTTPException(status_code=401, detail="Credenciales inválidas.")

    usuario_id = resultado.user.id

    perfil = supabase_admin.table("perfiles").select("nombre").eq("id", usuario_id).single().execute()
    nombre = perfil.data["nombre"] if perfil.data else ""

    return {
        "success": True,
        "user": {
            "id": usuario_id,
            "nombre": nombre,
            "correo": resultado.user.email,
        },
        "access_token": resultado.session.access_token,
    }

security = HTTPBearer()

def obtener_usuario_actual(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    try:
        resultado = supabase_admin.auth.get_user(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Token inválido o expirado.")
    if not resultado or not resultado.user:
        raise HTTPException(status_code=401, detail="Token inválido o expirado.")
    return resultado.user

@app.post("/auth/logout")
def cerrar_sesion(credentials: HTTPAuthorizationCredentials = Depends(security)):
    try:
        supabase_admin.auth.admin.sign_out(credentials.credentials)
    except Exception:
        pass
    return {"success": True}


@app.get("/auth/perfil")
def obtener_perfil(usuario=Depends(obtener_usuario_actual)):
    perfil = supabase_admin.table("perfiles").select("*").eq("id", usuario.id).single().execute()
    if not perfil.data:
        raise HTTPException(status_code=404, detail="Perfil no encontrado.")

    return {
        "nombre": perfil.data.get("nombre"),
        "correo": usuario.email,
        "telefono": perfil.data.get("telefono"),
        "ciudad": perfil.data.get("ciudad"),
        "biografia": perfil.data.get("biografia"),
    }


class PerfilUpdateRequest(BaseModel):
    nombre: str
    telefono: str | None = None
    ciudad: str | None = None
    biografia: str | None = None


@app.put("/auth/perfil")
def actualizar_perfil(datos: PerfilUpdateRequest, usuario=Depends(obtener_usuario_actual)):
    supabase_admin.table("perfiles").update({
        "nombre": datos.nombre,
        "telefono": datos.telefono,
        "ciudad": datos.ciudad,
        "biografia": datos.biografia,
    }).eq("id", usuario.id).execute()

    return {"success": True}