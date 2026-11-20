"""Argon2id y JWT propios adaptados de Francisco (21e9ffa).

Se usa PyJWT, ya declarado en este repositorio, en lugar de mantener dos SDK JWT.
No se aceptan IDs en cookies, tokens demo ni contraseñas en claro.
"""
import re
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4
from dataclasses import dataclass

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerificationError, InvalidHashError
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from backend.auth_service import database
from backend.auth_service.config import get_settings

ph = PasswordHasher(time_cost=3, memory_cost=65536, parallelism=4, hash_len=32, salt_len=16)
bearer = HTTPBearer(auto_error=False)


def auth_enabled():
    try:
        settings = get_settings()
    except (RuntimeError, ValueError):
        raise HTTPException(503, "Autenticación no disponible.") from None
    if not settings.enabled:
        raise HTTPException(503, "Autenticación JWT pendiente de habilitación.")
    return settings


def unauthorized():
    return HTTPException(401, "Token inválido, expirado o sesión no vigente.", headers={"WWW-Authenticate": "Bearer"})


def hash_password(password: str) -> str:
    return ph.hash(password)


def verify_password(password: str, hashed: str) -> bool:
    if not isinstance(hashed, str) or not hashed.startswith("$argon2"):
        return False
    try:
        return ph.verify(hashed, password)
    except (VerificationError, InvalidHashError):
        return False


def valid_user_id(value) -> bool:
    return isinstance(value, str) and re.fullmatch(r"[1-9][0-9]{0,18}", value) is not None and int(value) <= 9223372036854775807


def create_access_token(user_id: int) -> tuple[str, dict]:
    settings = auth_enabled()
    if type(user_id) is not int or not valid_user_id(str(user_id)):
        raise ValueError("Identificador inválido.")
    now = int(datetime.now(timezone.utc).timestamp())
    claims = {"sub": str(user_id), "iat": now,
              "exp": now + int(timedelta(minutes=settings.token_minutes).total_seconds()),
              "iss": settings.issuer, "aud": settings.audience, "jti": str(uuid4())}
    return jwt.encode(claims, settings.jwt_secret, algorithm="HS256"), claims


def decode_access_token(token: str) -> dict:
    settings = auth_enabled()
    try:
        if not isinstance(token, str) or len(token) > 4096:
            raise ValueError()
        claims = jwt.decode(token, settings.jwt_secret, algorithms=["HS256"],
                            issuer=settings.issuer, audience=settings.audience,
                            options={"require": ["sub", "exp", "iat", "iss", "aud", "jti"]})
        if not valid_user_id(claims["sub"]):
            raise ValueError()
        if any(type(claims[key]) is not int for key in ("iat", "exp")):
            raise ValueError()
        if not 0 < claims["exp"] - claims["iat"] <= settings.token_minutes * 60:
            raise ValueError()
        if str(UUID(claims["jti"])) != claims["jti"]:
            raise ValueError()
        return claims
    except (jwt.PyJWTError, ValueError, TypeError, KeyError, AttributeError):
        raise unauthorized() from None


@dataclass(frozen=True)
class Identity:
    user_id: int
    jti: str


def get_identity(credentials: HTTPAuthorizationCredentials | None = Depends(bearer), _=Depends(auth_enabled)) -> Identity:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise unauthorized()
    claims = decode_access_token(credentials.credentials)
    try:
        with database.conectar() as conn:
            row = conn.execute("""
                SELECT u.id_usuario FROM haycupo.usuario u
                JOIN haycupo.sesion_jwt s ON s.id_usuario = u.id_usuario
                WHERE u.id_usuario = %s AND u.verificado = TRUE
                  AND s.jti = %s AND s.revocado = FALSE
                  AND s.expira_en > clock_timestamp()
            """, (int(claims["sub"]), claims["jti"])).fetchone()
    except Exception:
        raise HTTPException(503, "No se pudo comprobar la sesión.") from None
    if row is None:
        raise unauthorized()
    return Identity(int(row[0]), claims["jti"])


def get_current_user(identity: Identity = Depends(get_identity)) -> int:
    return identity.user_id
