"""Importar router e iniciar_verificacion desde el archivo principal de FastAPI."""
import hashlib
import hmac
import os
import secrets
import smtplib
import ssl
from email.message import EmailMessage

import psycopg
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, EmailStr, Field

router = APIRouter(prefix="/api/correo", tags=["Verificación de correo"])


def conectar():
    return psycopg.connect(os.environ["DATABASE_URL"], connect_timeout=10)


def iniciar_verificacion():
    # Se ejecuta una vez al iniciar FastAPI. No modifica haycupo.usuario.
    with conectar() as conexion:
        conexion.execute("""
            CREATE TABLE IF NOT EXISTS public.verificacion_correo (
                correo TEXT PRIMARY KEY,
                codigo_hash TEXT NOT NULL,
                vence TIMESTAMPTZ NOT NULL,
                enviado TIMESTAMPTZ NOT NULL,
                intentos INTEGER NOT NULL DEFAULT 0,
                verificado BOOLEAN NOT NULL DEFAULT FALSE,
                ventana TIMESTAMPTZ NOT NULL,
                envios INTEGER NOT NULL DEFAULT 1
            )
        """)


class SolicitudCorreo(BaseModel):
    correo: EmailStr


class SolicitudCodigo(SolicitudCorreo):
    codigo: str = Field(pattern=r"^[0-9]{3}$")


def proteger(correo, codigo):
    clave = os.environ.get("CODIGO_SECRETO", "")
    if len(clave) < 32:
        raise HTTPException(503, "Configura CODIGO_SECRETO con al menos 32 caracteres.")
    return hmac.new(clave.encode(), f"{correo}:{codigo}".encode(), hashlib.sha256).hexdigest()


def enviar_email(correo, codigo):
    faltantes = [nombre for nombre in ("SMTP_HOST", "SMTP_USER", "SMTP_PASSWORD")
                 if not os.environ.get(nombre)]
    if faltantes:
        raise HTTPException(503, "Falta configurar el remitente: " + ", ".join(faltantes))
    host = os.environ["SMTP_HOST"]
    usuario = os.environ["SMTP_USER"]
    password = os.environ["SMTP_PASSWORD"]
    puerto = int(os.environ.get("SMTP_PORT", "587"))
    mensaje = EmailMessage()
    mensaje["From"] = os.environ.get("SMTP_FROM", usuario)
    mensaje["To"] = correo
    mensaje["Subject"] = "Código de verificación de HayCupo"
    mensaje.set_content(
        f"Tu código de verificación es: {codigo}\n\n"
        "Vence en 10 minutos. Si no lo solicitaste, ignora este correo."
    )
    contexto = ssl.create_default_context()
    if puerto == 465:
        with smtplib.SMTP_SSL(host, puerto, timeout=15, context=contexto) as servidor:
            servidor.login(usuario, password)
            servidor.send_message(mensaje)
    else:
        with smtplib.SMTP(host, puerto, timeout=15) as servidor:
            servidor.ehlo()
            servidor.starttls(context=contexto)
            servidor.ehlo()
            servidor.login(usuario, password)
            servidor.send_message(mensaje)


@router.post("/enviar-codigo")
def enviar_codigo(datos: SolicitudCorreo):
    correo = str(datos.correo)
    codigo = f"{secrets.randbelow(1_000):03d}"
    resumen = proteger(correo, codigo)
    try:
        with conectar() as conexion:
            # Serializa también las primeras solicitudes para un mismo correo.
            conexion.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s, 0))", (correo,))
            anterior = conexion.execute("""
                SELECT enviado > now() - interval '60 seconds',
                       ventana > now() - interval '1 hour', envios
                FROM public.verificacion_correo WHERE correo = %s FOR UPDATE
            """, (correo,)).fetchone()
            if anterior and (anterior[0] or (anterior[1] and anterior[2] >= 5)):
                raise HTTPException(429, "Espera 60 segundos entre envíos. Máximo 5 por hora.")
            conexion.execute("""
                INSERT INTO public.verificacion_correo
                    (correo, codigo_hash, vence, enviado, ventana)
                VALUES (%s, %s, now() + interval '10 minutes', now(), now())
                ON CONFLICT (correo) DO UPDATE SET
                    codigo_hash = EXCLUDED.codigo_hash,
                    vence = EXCLUDED.vence, enviado = now(), intentos = 0,
                    verificado = FALSE,
                    envios = CASE WHEN verificacion_correo.ventana > now() - interval '1 hour'
                                  THEN verificacion_correo.envios + 1 ELSE 1 END,
                    ventana = CASE WHEN verificacion_correo.ventana > now() - interval '1 hour'
                                   THEN verificacion_correo.ventana ELSE now() END
            """, (correo, resumen))
            # Si SMTP falla, se revierte el cambio en PostgreSQL.
            enviar_email(correo, codigo)
    except smtplib.SMTPAuthenticationError:
        raise HTTPException(503, "El proveedor rechazó las credenciales del remitente SMTP.") from None
    except (smtplib.SMTPException, OSError, ValueError, KeyError):
        raise HTTPException(503, "No se pudo enviar el correo. Revisa la configuración SMTP.") from None
    except psycopg.Error:
        raise HTTPException(503, "No se pudo guardar el código en PostgreSQL.") from None
    return {"enviado": True, "mensaje": "Revisa tu correo. El código vence en 10 minutos."}


@router.post("/verificar-codigo")
def verificar_codigo(datos: SolicitudCodigo):
    correo = str(datos.correo)
    resumen = proteger(correo, datos.codigo)
    correcto = False
    try:
        with conectar() as conexion:
            fila = conexion.execute("""
                SELECT codigo_hash, vence > now(), intentos, verificado
                FROM public.verificacion_correo WHERE correo = %s FOR UPDATE
            """, (correo,)).fetchone()
            if fila and fila[1] and fila[2] < 5 and not fila[3]:
                correcto = hmac.compare_digest(fila[0], resumen)
                if correcto:
                    conexion.execute("""
                        UPDATE public.verificacion_correo
                        SET verificado = TRUE, codigo_hash = '' WHERE correo = %s
                    """, (correo,))
                else:
                    conexion.execute("""
                        UPDATE public.verificacion_correo SET intentos = intentos + 1
                        WHERE correo = %s
                    """, (correo,))
            # Dejar salir el contexto confirma los intentos fallidos también.
    except psycopg.Error:
        raise HTTPException(503, "No se pudo consultar PostgreSQL.") from None
    return {
        "resultado": "CORRECTO" if correcto else "INCORRECTO",
        "verificado": correcto,
        "mensaje": "Correo verificado." if correcto else "Código inválido, vencido, usado o sin intentos disponibles.",
    }
