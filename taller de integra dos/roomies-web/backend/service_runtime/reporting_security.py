"""Credenciales JWT de servicio con emisor, audiencia y vida acotados."""
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


def service_token(issuer, destination, variable):
    now = int(time.time())
    return jwt.encode(
        {"iss": issuer, "aud": destination, "iat": now, "exp": now + 60},
        service_key(variable),
        algorithm="HS256",
    )


def verify_service_token(authorization, issuer, destination, variable):
    scheme, _, token = (authorization or "").partition(" ")
    if scheme.lower() != "bearer" or not token or len(token) > 2048:
        raise HTTPException(401, "Credencial de servicio requerida.")
    try:
        claims = jwt.decode(
            token, service_key(variable), algorithms=["HS256"], issuer=issuer,
            audience=destination, options={"require": ["iss", "aud", "iat", "exp"], "strict_aud": True},
        )
        if type(claims["iat"]) is not int or type(claims["exp"]) is not int or not 0 < claims["exp"] - claims["iat"] <= 60:
            raise ValueError()
    except (jwt.PyJWTError, ValueError, TypeError, OverflowError):
        raise HTTPException(403, "Credencial de servicio inválida.") from None


def report_service_token(destination, variable):
    return service_token("reportes", destination, variable)


def verify_report_service(authorization, destination, variable):
    verify_service_token(authorization, "reportes", destination, variable)
