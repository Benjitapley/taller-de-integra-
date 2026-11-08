"""Verificación de access tokens Supabase con una URL JWKS fijada por Settings."""

import json
from typing import Protocol
from uuid import UUID

import jwt

from app.domain.identity import VerifiedIdentity
from app.infrastructure.settings import SupabaseJWTSettings


class InvalidAccessToken(Exception):
    """El Bearer no tiene firma, claims o identidad aceptables."""


class IdentityProviderUnavailable(Exception):
    """No fue posible obtener las claves públicas del proveedor."""


class SigningKeyResolver(Protocol):
    def get_signing_key_from_jwt(self, token: str): ...


class SupabaseJWTVerifier:
    def __init__(
        self,
        settings: SupabaseJWTSettings,
        signing_key_resolver: SigningKeyResolver | None = None,
    ) -> None:
        self._settings = settings
        self._signing_key_resolver = signing_key_resolver or jwt.PyJWKClient(
            settings.jwks_url,
            timeout=settings.jwks_timeout_seconds,
            lifespan=settings.jwks_cache_seconds,
        )

    def verify(self, token: str) -> VerifiedIdentity:
        if not isinstance(token, str) or not token or len(token) > self._settings.max_token_length:
            raise InvalidAccessToken()

        try:
            signing_key = self._signing_key_resolver.get_signing_key_from_jwt(token)
        except jwt.PyJWKClientConnectionError:
            raise IdentityProviderUnavailable() from None
        except (jwt.PyJWKSetError, jwt.PyJWKError, json.JSONDecodeError):
            # A broken/unusable JWKS is an identity-provider failure, not a
            # property of the caller's access token.
            raise IdentityProviderUnavailable() from None
        except jwt.PyJWKClientError:
            raise InvalidAccessToken() from None
        except (jwt.PyJWTError, ValueError, TypeError, KeyError):
            # PyJWKClient parses the unverified JWT header before it fetches
            # JWKS. Malformed token errors can therefore happen in this block.
            raise InvalidAccessToken() from None

        try:
            claims = jwt.decode(
                token,
                signing_key.key,
                algorithms=list(self._settings.algorithms),
                issuer=self._settings.issuer,
                audience=self._settings.audience,
                options={"require": ["sub", "iss", "aud", "exp", "iat"]},
            )
            subject = claims.get("sub")
            if not isinstance(subject, str):
                raise InvalidAccessToken()
            user_id = UUID(subject)
            if str(user_id) != subject:
                raise InvalidAccessToken()
            return VerifiedIdentity(supabase_user_id=user_id)
        except InvalidAccessToken:
            raise
        except (jwt.PyJWTError, ValueError, TypeError, KeyError):
            raise InvalidAccessToken() from None
