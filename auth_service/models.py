"""
Schemas Pydantic para el auth_service.
Define los modelos de request y response para todos los endpoints de autenticación.
"""

from datetime import date
from pydantic import BaseModel, EmailStr


class RegistroRequest(BaseModel):
    """Datos requeridos para registrar un nuevo usuario."""
    nombre: str
    correo: EmailStr
    contrasena: str
    fecha_nacimiento: date


class LoginRequest(BaseModel):
    """Credenciales para iniciar sesión."""
    correo: EmailStr
    contrasena: str


class VerificacionRequest(BaseModel):
    """Datos para verificar la cuenta con el código enviado por correo."""
    correo: EmailStr
    codigo: str


class ReenviarCodigoRequest(BaseModel):
    """Solicitud para reenviar el código de verificación."""
    correo: EmailStr


class TokenResponse(BaseModel):
    """Respuesta con el token JWT tras un login exitoso."""
    success: bool
    access_token: str
    token_type: str = "bearer"
    user: dict


class MessageResponse(BaseModel):
    """Respuesta genérica con un mensaje."""
    success: bool
    message: str
