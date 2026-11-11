"""Fail-closed, environment-specific Auth/Users PostgreSQL settings."""

import os
from dataclasses import dataclass
from typing import Mapping
from urllib.parse import parse_qsl, unquote, urlsplit


class DatabaseSettingsError(ValueError):
    """Database configuration is missing or violates its target environment policy."""


_DEVELOPMENT_DATABASE = "roomies_auth_users_dev"
_DEVELOPMENT_TARGETS = {
    ("127.0.0.1", 15432),
    ("host.docker.internal", 15432),
    ("auth-users-db", 5432),
}
_STAGING_SSL_MODES = frozenset({"require", "verify-ca", "verify-full"})
_STAGING_QUERY_KEYS = frozenset({"sslmode", "sslrootcert", "sslcert", "sslkey"})


@dataclass(frozen=True, slots=True)
class PostgresDatabaseSettings:
    database_url: str
    environment: str = "development"
    connect_timeout_seconds: int = 3

    @classmethod
    def from_environment(
        cls, environ: Mapping[str, str] | None = None
    ) -> "PostgresDatabaseSettings":
        env = os.environ if environ is None else environ
        database_url = env.get("AUTH_USERS_DATABASE_URL", "").strip()
        if not database_url:
            raise DatabaseSettingsError("Falta AUTH_USERS_DATABASE_URL.")

        environment = env.get("AUTH_USERS_DATABASE_ENVIRONMENT", "development").strip().lower()
        if environment not in {"development", "staging"}:
            raise DatabaseSettingsError(
                "AUTH_USERS_DATABASE_ENVIRONMENT debe ser development o staging."
            )

        try:
            parsed = urlsplit(database_url)
            host = (parsed.hostname or "").lower()
            database_name = unquote(parsed.path.removeprefix("/"))
            timeout = int(env.get("AUTH_USERS_DB_CONNECT_TIMEOUT_SECONDS", "3"))
            parsed_port = parsed.port
            port = (
                parsed_port if parsed_port is not None else (5432 if environment == "staging" else None)
            )
            query_items = parse_qsl(parsed.query, keep_blank_values=True)
        except (ValueError, UnicodeError):
            raise DatabaseSettingsError("AUTH_USERS_DATABASE_URL no es válida.") from None

        if parsed.scheme not in {"postgres", "postgresql"} or not host or not database_name:
            raise DatabaseSettingsError(
                "AUTH_USERS_DATABASE_URL debe ser una URL PostgreSQL válida."
            )
        if parsed.username != "sql_auth_users":
            raise DatabaseSettingsError("La conexión de runtime debe usar sql_auth_users.")
        if parsed.fragment or not 1 <= timeout <= 15:
            raise DatabaseSettingsError("La URL o el timeout de PostgreSQL no son válidos.")

        if environment == "development":
            if (
                (host, port) not in _DEVELOPMENT_TARGETS
                or database_name != _DEVELOPMENT_DATABASE
                or query_items
            ):
                raise DatabaseSettingsError(
                    "Desarrollo debe apuntar a roomies_auth_users_dev en un destino local permitido."
                )
        else:
            allowed_hosts = {
                item.strip().lower()
                for item in env.get("AUTH_USERS_STAGING_ALLOWED_HOSTS", "").split(",")
                if item.strip()
            }
            query = {}
            for key, value in query_items:
                if key in query:
                    raise DatabaseSettingsError("La URL de staging contiene parámetros repetidos.")
                query[key] = value
            sslmode = query.get("sslmode", "").lower()
            if (
                not allowed_hosts
                or host not in allowed_hosts
                or host in {"localhost", "127.0.0.1", "::1"}
                or port is None
                or not 1 <= port <= 65535
                or sslmode not in _STAGING_SSL_MODES
                or set(query) - _STAGING_QUERY_KEYS
                or any(not query[key] for key in set(query) - {"sslmode"})
            ):
                raise DatabaseSettingsError(
                    "Staging requiere un host autorizado y SSL explícito."
                )

        return cls(
            database_url=database_url,
            environment=environment,
            connect_timeout_seconds=timeout,
        )
