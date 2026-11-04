"""Configuración explícita. Importar no lee .env ni inicia servicios."""
import os
from dataclasses import dataclass
from functools import lru_cache


@dataclass(frozen=True)
class Settings:
    enabled: bool = False
    jwt_secret: str = ""
    code_secret: str = ""
    issuer: str = "haycupo-api"
    audience: str = "haycupo-clients"
    token_minutes: int = 15
    code_minutes: int = 15
    max_attempts: int = 5
    resend_seconds: int = 60
    sends_per_hour: int = 5


@lru_cache
def get_settings() -> Settings:
    flag = os.getenv("AUTH_JWT_ENABLED", "false").lower()
    if flag not in {"true", "false"}:
        raise RuntimeError("AUTH_JWT_ENABLED debe ser true o false.")
    if flag == "false":
        return Settings()
    secret = os.getenv("JWT_SECRET_KEY", "")
    code_secret = os.getenv("AUTH_CODE_SECRET", "")
    if len(secret.encode()) < 32 or len(code_secret.encode()) < 32 or secret == code_secret:
        raise RuntimeError("Configura secretos independientes de al menos 32 bytes para JWT y códigos.")
    if os.getenv("JWT_ALGORITHM", "HS256") != "HS256":
        raise RuntimeError("Esta adaptación admite únicamente HS256.")
    minutes = int(os.getenv("JWT_EXPIRATION_MINUTES", "15"))
    code_minutes = int(os.getenv("CODIGO_EXPIRACION_MINUTOS", "15"))
    if not 1 <= minutes <= 60 or not 1 <= code_minutes <= 30:
        raise RuntimeError("Duración JWT fuera de 1..60 o de código fuera de 1..30 minutos.")
    return Settings(enabled=True, jwt_secret=secret, code_secret=code_secret,
                    token_minutes=minutes, code_minutes=code_minutes)
