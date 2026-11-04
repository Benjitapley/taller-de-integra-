"""Dependencias HTTP para validar identidades Supabase en rutas privadas."""

from functools import lru_cache

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.application.profile_repository import ProfileRepository
from app.domain.identity import VerifiedIdentity
from app.infrastructure.security.supabase_jwt import (
    IdentityProviderUnavailable,
    InvalidAccessToken,
    SupabaseJWTVerifier,
)
from app.infrastructure.settings import SettingsError, SupabaseJWTSettings
from app.infrastructure.persistence.postgres_profile_repository import (
    PostgresProfileRepository,
)
from app.infrastructure.persistence.settings import (
    DatabaseSettingsError,
    PostgresDatabaseSettings,
)

bearer_scheme = HTTPBearer(auto_error=False)


def get_profile_repository() -> ProfileRepository:
    """Build the real adapter only from explicit, isolated dev configuration."""

    import os
    if os.environ.get("ROOMIES_LOCAL_MODE")=="1" or os.environ.get("ROOMIES_RUNTIME_MODE")=="supabase":
        from app.infrastructure.persistence.local_profile_adapter import LocalProfileAdapter
        return LocalProfileAdapter()
    try:
        settings = PostgresDatabaseSettings.from_environment()
    except DatabaseSettingsError:
        raise HTTPException(
            status_code=503,
            detail="La persistencia Auth/Users no está configurada para desarrollo aislado.",
        ) from None
    return PostgresProfileRepository(settings)


@lru_cache
def get_jwt_settings() -> SupabaseJWTSettings:
    return SupabaseJWTSettings.from_environment()


@lru_cache
def get_jwt_verifier() -> SupabaseJWTVerifier:
    try:
        return SupabaseJWTVerifier(get_jwt_settings())
    except SettingsError:
        raise HTTPException(
            status_code=503,
            detail="La verificación de identidad no está configurada.",
        ) from None


def get_current_identity(
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer_scheme),
    verifier: SupabaseJWTVerifier = Depends(get_jwt_verifier),
) -> VerifiedIdentity:
    if credentials is None or credentials.scheme.lower() != "bearer":
        raise HTTPException(
            status_code=401,
            detail="Se requiere un access token Bearer válido.",
            headers={"WWW-Authenticate": "Bearer"},
        )

    import os
    if os.environ.get("ROOMIES_LOCAL_MODE")=="1" or os.environ.get("ROOMIES_RUNTIME_MODE")=="supabase":
        from app.api.routes.local_users import identity
        subject,_=identity(credentials.credentials)
        return VerifiedIdentity(supabase_user_id=subject)

    try:
        return verifier.verify(credentials.credentials)
    except InvalidAccessToken:
        raise HTTPException(
            status_code=401,
            detail="El access token no es válido.",
            headers={"WWW-Authenticate": "Bearer"},
        ) from None
    except IdentityProviderUnavailable:
        raise HTTPException(
            status_code=503,
            detail="No se pudo verificar la identidad en este momento.",
        ) from None
