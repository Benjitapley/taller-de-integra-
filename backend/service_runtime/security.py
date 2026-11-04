"""Verificador JWKS reutilizable para los servicios locales independientes."""
from functools import lru_cache
import os
from uuid import UUID

import httpx
import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials

from .contracts import Actor, DependencyUnavailable
from .settings import service_url, auth_provider_url, runtime_mode

bearer = HTTPBearer(auto_error=False)


@lru_cache
def verifier():
    provider = auth_provider_url()
    return jwt.PyJWKClient(provider + "/auth/v1/.well-known/jwks.json", timeout=3, lifespan=60)


def verified_claims(token):
    try:
        provider = auth_provider_url()
        issuer = provider + "/auth/v1" if runtime_mode() == "supabase" else os.environ.get("ROOMIES_JWT_ISSUER") or provider + "/auth/v1"
        key = verifier().get_signing_key_from_jwt(token)
        claims = jwt.decode(token, key.key, algorithms=["ES256", "RS256"],
                            issuer=issuer, audience="authenticated",
                            options={"require": ["sub", "iat", "exp", "iss", "aud"]})
        subject = UUID(claims["sub"])
        if str(subject) != claims["sub"]:
            raise ValueError()
        return claims
    except (jwt.PyJWKClientConnectionError, DependencyUnavailable):
        raise HTTPException(503, "No se pudo verificar la identidad.") from None
    except (jwt.PyJWTError, ValueError, TypeError, KeyError):
        raise HTTPException(401, "Token inválido.", headers={"WWW-Authenticate": "Bearer"}) from None


def verified_subject(token):
    return UUID(verified_claims(token)["sub"])


def access_token(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)):
    if credentials is None or credentials.scheme.lower() != "bearer" or len(credentials.credentials) > 16384:
        raise HTTPException(401, "Se requiere sesión válida.")
    verified_subject(credentials.credentials)
    return credentials.credentials


def actor(token: str = Depends(access_token)):
    subject = verified_subject(token)
    try:
        url = service_url("AUTH_USERS_UPSTREAM_URL", docker_hosts=("auth-users",))
        with httpx.Client(timeout=5, trust_env=False, follow_redirects=False) as client:
            response = client.get(url + "/internal/v1/identidad", headers={"Authorization": "Bearer " + token})
        if response.status_code in {401, 403, 404, 409}:
            raise HTTPException(response.status_code, "La cuenta no está habilitada para esta operación.")
        response.raise_for_status()
        value = response.json()
        if value["subject"] != str(subject) or type(value["user_id"]) is not int or value["user_id"] < 1 or type(value["email_confirmed"]) is not bool or type(value["administrator"]) is not bool:
            raise ValueError()
        return Actor(subject, value["user_id"], value["email_confirmed"], value["administrator"])
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(503, "No se pudo consultar la identidad de negocio.") from None


def confirmed_actor(identity: Actor = Depends(actor)):
    if not identity.email_confirmed:
        raise HTTPException(403, "Confirma tu correo antes de continuar.")
    return identity


def admin_actor(identity: Actor = Depends(confirmed_actor)):
    if not identity.administrator:
        raise HTTPException(403, "Acceso administrativo no permitido.")
    return identity
