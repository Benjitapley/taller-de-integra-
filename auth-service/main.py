import os
from datetime import date, datetime
from fastapi import FastAPI, HTTPException, Depends, Header
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, EmailStr
from dotenv import load_dotenv
from supabase import create_client, Client

load_dotenv()

SUPABASE_URL = os.environ.get("SUPABASE_URL")
SUPABASE_ANON_KEY = os.environ.get("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_KEY = os.environ.get("SUPABASE_SERVICE_KEY")

# Cliente con permisos de administrador (para crear/leer perfiles sin restricciones)
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


@app.get("/")
def inicio():
    return {"message": "Auth service de Roomies funcionando"}

@app.get("/test-supabase")
def test_supabase():
    try:
        response = supabase_admin.auth.admin.list_users()
        return {"conectado": True, "usuarios_existentes": len(response)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    