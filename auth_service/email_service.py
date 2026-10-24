"""
Servicio de envío de correos electrónicos para verificación.
Usa SMTP real (Gmail u otro proveedor).
"""

import os
import random
import smtplib
import logging
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# ==========================================
# CONFIGURACIÓN SMTP
# ==========================================
SMTP_HOST = os.getenv("SMTP_HOST", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
SMTP_FROM_NAME = os.getenv("SMTP_FROM_NAME", "Roomies - HayCupo")

# Minutos de validez del código de verificación
CODIGO_EXPIRACION_MINUTOS = int(os.getenv("CODIGO_EXPIRACION_MINUTOS", "15"))


def generar_codigo(longitud: int = 6) -> str:
    """Genera un código numérico aleatorio de N dígitos."""
    return "".join(str(random.randint(0, 9)) for _ in range(longitud))


def calcular_expiracion() -> datetime:
    """Calcula la fecha/hora de expiración del código."""
    return datetime.now(timezone.utc) + timedelta(minutes=CODIGO_EXPIRACION_MINUTOS)


def _construir_html(nombre: str, codigo: str) -> str:
    """Construye el HTML del correo de verificación."""
    return f"""
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
    </head>
    <body style="margin:0; padding:0; background-color:#f4f4f7; font-family: 'Segoe UI', Arial, sans-serif;">
        <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f7; padding: 40px 0;">
            <tr>
                <td align="center">
                    <table width="480" cellpadding="0" cellspacing="0" style="background-color:#ffffff; border-radius:12px; overflow:hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.1);">
                        <!-- Header -->
                        <tr>
                            <td style="background: linear-gradient(135deg, #6366f1, #8b5cf6); padding: 32px; text-align:center;">
                                <h1 style="color:#ffffff; margin:0; font-size:28px;">🏠 Roomies</h1>
                                <p style="color:#e0e7ff; margin:8px 0 0; font-size:14px;">Verificación de cuenta</p>
                            </td>
                        </tr>
                        <!-- Body -->
                        <tr>
                            <td style="padding: 32px;">
                                <p style="color:#374151; font-size:16px; margin:0 0 16px;">
                                    ¡Hola <strong>{nombre}</strong>! 👋
                                </p>
                                <p style="color:#6b7280; font-size:14px; margin:0 0 24px; line-height:1.6;">
                                    Gracias por registrarte en Roomies. Para completar tu registro, ingresa el siguiente código de verificación:
                                </p>
                                <!-- Código -->
                                <table width="100%" cellpadding="0" cellspacing="0">
                                    <tr>
                                        <td align="center" style="padding: 20px 0;">
                                            <div style="background-color:#f0f0ff; border: 2px dashed #6366f1; border-radius:12px; padding: 20px 40px; display:inline-block;">
                                                <span style="font-size:36px; font-weight:bold; letter-spacing:8px; color:#6366f1; font-family: 'Courier New', monospace;">
                                                    {codigo}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                </table>
                                <p style="color:#9ca3af; font-size:13px; margin:24px 0 0; text-align:center;">
                                    ⏳ Este código expira en <strong>{CODIGO_EXPIRACION_MINUTOS} minutos</strong>.
                                </p>
                                <p style="color:#9ca3af; font-size:13px; margin:8px 0 0; text-align:center;">
                                    Si no solicitaste esta verificación, puedes ignorar este correo.
                                </p>
                            </td>
                        </tr>
                        <!-- Footer -->
                        <tr>
                            <td style="background-color:#f9fafb; padding: 20px 32px; text-align:center; border-top: 1px solid #e5e7eb;">
                                <p style="color:#9ca3af; font-size:12px; margin:0;">
                                    © 2026 Roomies - HayCupo · Taller de Integración II
                                </p>
                            </td>
                        </tr>
                    </table>
                </td>
            </tr>
        </table>
    </body>
    </html>
    """


def enviar_codigo_verificacion(destinatario: str, nombre: str, codigo: str) -> bool:
    """Envía un correo con el código de verificación.
    
    Args:
        destinatario: Correo electrónico del usuario.
        nombre: Nombre del usuario para personalizar el mensaje.
        codigo: Código de 6 dígitos a enviar.
    
    Returns:
        True si el envío fue exitoso, False si hubo un error.
    """
    if not SMTP_USER or not SMTP_PASSWORD:
        logger.error("Las credenciales SMTP no están configuradas en el .env")
        return False

    mensaje = MIMEMultipart("alternative")
    mensaje["Subject"] = f"🔐 Tu código de verificación: {codigo}"
    mensaje["From"] = f"{SMTP_FROM_NAME} <{SMTP_USER}>"
    mensaje["To"] = destinatario

    # Versión texto plano (fallback)
    texto_plano = (
        f"Hola {nombre},\n\n"
        f"Tu código de verificación para Roomies es: {codigo}\n\n"
        f"Este código expira en {CODIGO_EXPIRACION_MINUTOS} minutos.\n\n"
        f"Si no solicitaste esta verificación, ignora este correo.\n\n"
        f"— Equipo Roomies"
    )
    
    mensaje.attach(MIMEText(texto_plano, "plain", "utf-8"))
    mensaje.attach(MIMEText(_construir_html(nombre, codigo), "html", "utf-8"))

    try:
        with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=15) as servidor:
            servidor.ehlo()
            servidor.starttls()
            servidor.ehlo()
            servidor.login(SMTP_USER, SMTP_PASSWORD)
            servidor.sendmail(SMTP_USER, destinatario, mensaje.as_string())
        
        logger.info(f"Código de verificación enviado a {destinatario}")
        return True

    except smtplib.SMTPAuthenticationError:
        logger.error(
            "Error de autenticación SMTP. Verifica SMTP_USER y SMTP_PASSWORD en el .env. "
            "Para Gmail, usa una Contraseña de Aplicación."
        )
        return False
    except smtplib.SMTPException as e:
        logger.error(f"Error SMTP al enviar correo a {destinatario}: {e}")
        return False
    except Exception as e:
        logger.error(f"Error inesperado al enviar correo: {e}")
        return False
