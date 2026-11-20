"""JWT de servicio de Reportes, con una clave distinta por destino."""
import os
import time

import jwt
from fastapi import HTTPException

from .contracts import DependencyUnavailable


def service_key(variable):
    key = os.environ.get(variable, "")
    if len(key) < 32 or not key.isascii() or any(char.isspace() for char in key):
        raise DependencyUnavailable()
    return key


def report_service_token(destination, variable):
    now = int(time.time())
    return jwt.encode(
        {"iss": "reportes", "aud": destination, "iat": now, "exp": now + 60},
        service_key(variable),
        algorithm="HS256",
    )


def verify_report_service(authorization, destination, variable):
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not token or len(token) > 2048:
        raise HTTPException(401, "Credencial de servicio requerida.")
    try:
        claims = jwt.decode(
            token, service_key(variable), algorithms=["HS256"], issuer="reportes",
            audience=destination, options={"require": ["iss", "aud", "iat", "exp"], "strict_aud": True},
        )
        if type(claims["iat"]) is not int or type(claims["exp"]) is not int or not 0 < claims["exp"] - claims["iat"] <= 60:
            raise ValueError()
    except (jwt.PyJWTError, ValueError, TypeError, OverflowError):
        raise HTTPException(403, "Credencial de servicio inválida.") from None
