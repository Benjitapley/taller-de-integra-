"""Nombres JSON de 21e9ffa; sin normalizar ni recortar contraseñas."""
import re
from datetime import date
from typing import Literal
from pydantic import BaseModel, EmailStr, Field, field_validator


class CorreoRequest(BaseModel):
    correo: EmailStr

    @field_validator("correo")
    @classmethod
    def normalizar_correo(cls, value):
        return str(value).lower()


class RegistroRequest(CorreoRequest):
    nombre: str = Field(min_length=1, max_length=200)
    contrasena: str = Field(min_length=1, max_length=1024)
    fecha_nacimiento: date

    @field_validator("nombre")
    @classmethod
    def nombre_no_vacio(cls, value):
        if not value.strip():
            raise ValueError("Ingresa un nombre no vacío.")
        return value.strip()


class LoginRequest(CorreoRequest):
    contrasena: str = Field(min_length=1, max_length=1024)


class VerificacionRequest(CorreoRequest):
    codigo: str

    @field_validator("codigo")
    @classmethod
    def seis_digitos(cls, value):
        if re.fullmatch(r"[0-9]{6}", value) is None:
            raise ValueError("El código debe contener exactamente seis dígitos.")
        return value


class ReenviarCodigoRequest(CorreoRequest):
    pass


class MessageResponse(BaseModel):
    success: Literal[True] = True
    message: str


class RegistroResponse(MessageResponse):
    verificacion_pendiente: Literal[True] = True


class UserResponse(BaseModel):
    id: int
    nombre: str
    correo: EmailStr


class TokenResponse(BaseModel):
    success: Literal[True] = True
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    user: UserResponse
