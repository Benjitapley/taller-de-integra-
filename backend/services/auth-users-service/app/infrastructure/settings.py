"""Configuración fail-closed de Supabase Auth y su endpoint JWKS."""

import os
from dataclasses import dataclass
from typing import Mapping
from urllib.parse import urlsplit


class SettingsError(ValueError):
    """Falta configuración requerida o contiene una URL/algoritmo inválido."""


ASYMMETRIC_ALGORITHMS = frozenset({"ES256", "RS256"})


def _validate_service_url(value: str, name: str, *, allow_path: bool) -> str:
    parsed = urlsplit(value)
    local_http = parsed.scheme == "http" and parsed.hostname in {"localhost", "127.0.0.1", "::1"}
    if (
        not parsed.hostname
        or (parsed.scheme != "https" and not local_http)
        or parsed.username
        or parsed.password
        or parsed.query
        or parsed.fragment
        or (not allow_path and parsed.path not in {"", "/"})
    ):
        raise SettingsError(f"{name} debe ser una URL HTTPS válida; HTTP solo se permite en loopback.")
    return f"{parsed.scheme}://{parsed.netloc}{parsed.path.rstrip('/') if allow_path else ''}"


@dataclass(frozen=True, slots=True)
class SupabaseJWTSettings:
    jwks_url: str
    issuer: str
    audience: str
    algorithms: tuple[str, ...]
    jwks_timeout_seconds: float = 5.0
    jwks_cache_seconds: int = 300
    max_token_length: int = 16_384

    @classmethod
    def from_environment(
        cls, environ: Mapping[str, str] | None = None
    ) -> "SupabaseJWTSettings":
        env = os.environ if environ is None else environ
        supabase_url_raw = env.get("SUPABASE_URL", "").strip()
        audience = env.get("SUPABASE_JWT_AUDIENCE", "").strip()
        algorithm_text = env.get("SUPABASE_JWT_ALGORITHMS", "").strip()
        if not supabase_url_raw:
            raise SettingsError("Falta SUPABASE_URL.")
        if not audience:
            raise SettingsError("Falta SUPABASE_JWT_AUDIENCE.")
        if not algorithm_text:
            raise SettingsError("Falta SUPABASE_JWT_ALGORITHMS.")

        base_url = _validate_service_url(supabase_url_raw, "SUPABASE_URL", allow_path=False)
        algorithms = tuple(dict.fromkeys(part.strip() for part in algorithm_text.split(",") if part.strip()))
        if not algorithms or any(algorithm not in ASYMMETRIC_ALGORITHMS for algorithm in algorithms):
            raise SettingsError("SUPABASE_JWT_ALGORITHMS solo admite ES256 y/o RS256.")

        issuer_raw = env.get("SUPABASE_JWT_ISSUER", "").strip() or f"{base_url}/auth/v1"
        issuer = _validate_service_url(issuer_raw, "SUPABASE_JWT_ISSUER", allow_path=True)
        jwks_raw = env.get("SUPABASE_JWKS_URL", "").strip() or f"{base_url}/auth/v1/.well-known/jwks.json"
        jwks_url = _validate_service_url(jwks_raw, "SUPABASE_JWKS_URL", allow_path=True)

        try:
            timeout = float(env.get("SUPABASE_JWKS_TIMEOUT_SECONDS", "5"))
            cache_seconds = int(env.get("SUPABASE_JWKS_CACHE_SECONDS", "300"))
        except ValueError:
            raise SettingsError("Timeout o caché JWKS no tienen formato válido.") from None
        if not 1 <= timeout <= 30 or not 30 <= cache_seconds <= 3600:
            raise SettingsError("Timeout o caché JWKS fuera de los límites permitidos.")

        return cls(
            jwks_url=jwks_url,
            issuer=issuer,
            audience=audience,
            algorithms=algorithms,
            jwks_timeout_seconds=timeout,
            jwks_cache_seconds=cache_seconds,
        )
