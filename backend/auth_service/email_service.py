"""SMTP explícito, sin conexiones al importar ni datos sensibles en logs."""
import os
import ssl
import secrets
import hashlib
import hmac
from email.message import EmailMessage
import smtplib
from backend.auth_service.config import get_settings


def generar_codigo() -> str:
    return f"{secrets.randbelow(1_000_000):06d}"


def huella_codigo(user_id: int, codigo: str) -> str:
    # El pepper separado evita ataques offline sobre un espacio de solo 10^6 códigos.
    key = get_settings().code_secret
    if not key:
        raise RuntimeError("Falta secreto de códigos.")
    return hmac.new(key.encode(), f"{user_id}:{codigo}".encode(), hashlib.sha256).hexdigest()


def enviar_codigo_verificacion(destinatario: str, nombre: str, codigo: str) -> bool:
    user, password = os.getenv("SMTP_USER"), os.getenv("SMTP_PASSWORD")
    host = os.getenv("SMTP_HOST")
    if not all((user, password, host)):
        return False
    try:
        message = EmailMessage()
        message["Subject"] = "Verificación de correo — ¿Hay cupo?"
        message["From"] = user
        message["To"] = destinatario
        message.set_content(f"Hola {nombre},\n\nTu código de verificación es {codigo}. "
                            f"Caduca en {get_settings().code_minutes} minutos.\n"
                            "Si no solicitaste este correo, puedes ignorarlo.")
        with smtplib.SMTP(host, int(os.getenv("SMTP_PORT", "587")), timeout=15) as server:
            server.ehlo()
            server.starttls(context=ssl.create_default_context())
            server.ehlo()
            server.login(user, password)
            server.send_message(message)
        return True
    except Exception:
        return False
