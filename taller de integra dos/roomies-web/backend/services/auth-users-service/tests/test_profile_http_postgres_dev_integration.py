"""Opt-in HTTP integration that writes one synthetic profile to local dev PostgreSQL.

Run only with AUTH_USERS_RUN_POSTGRES_DEV_HTTP_INTEGRATION=1 after verifying
that AUTH_USERS_DATABASE_URL targets the dedicated local dev instance. The
synthetic row is idempotent and remains in that development database.
"""

import os
from datetime import date
from urllib.parse import unquote, urlsplit
from uuid import UUID

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.dependencies import get_current_identity, get_profile_repository
from app.api.profile_api import register_profile_routes
from app.domain.identity import VerifiedIdentity
from app.infrastructure.persistence.settings import (
    DatabaseSettingsError,
    PostgresDatabaseSettings,
)


RUN_FLAG = "AUTH_USERS_RUN_POSTGRES_DEV_HTTP_INTEGRATION"
EXPECTED_IDENTITY = VerifiedIdentity(
    UUID("00000000-0000-4000-8000-000000007777")
)
EXPECTED_DATABASE = "roomies_auth_users_dev"


def _require_exact_local_development_database() -> None:
    try:
        settings = PostgresDatabaseSettings.from_environment()
        parsed = urlsplit(settings.database_url)
        database_name = unquote(parsed.path.removeprefix("/"))
        port = parsed.port
    except (DatabaseSettingsError, ValueError, UnicodeError):
        pytest.fail("La integración requiere AUTH_USERS_DATABASE_URL local válida.")

    if (
        settings.environment != "development"
        or parsed.scheme not in {"postgres", "postgresql"}
        or parsed.hostname != "127.0.0.1"
        or port != 15432
        or database_name != EXPECTED_DATABASE
        or parsed.username != "sql_auth_users"
        or parsed.query
        or parsed.fragment
    ):
        pytest.fail(
            "La prueba solo permite 127.0.0.1:15432/roomies_auth_users_dev "
            "con el rol de runtime dedicado."
        )


def test_profile_http_get_and_patch_use_local_postgres_with_test_identity():
    if os.environ.get(RUN_FLAG) != "1":
        pytest.skip(f"Prueba con escritura local opt-in: requiere {RUN_FLAG}=1.")

    _require_exact_local_development_database()

    # This is the real production repository and dependency. The UUID is a
    # synthetic test identity, unrelated to any Supabase account.
    repository = get_profile_repository()
    repository.ensure_profile(
        EXPECTED_IDENTITY.supabase_user_id,
        nombre="SCRUM-77 perfil de integración",
        fecha_nacimiento=date(2000, 1, 15),
    )

    test_app = FastAPI()
    register_profile_routes(test_app)
    # Override only the verified identity dependency in this isolated app.
    # The production app and real PostgreSQL repository remain unchanged.
    test_app.dependency_overrides[get_current_identity] = lambda: EXPECTED_IDENTITY

    with TestClient(test_app) as client:
        current = client.get("/usuarios/me")
        assert current.status_code == 200
        assert current.headers["cache-control"] == "no-store"
        assert current.json()["nombre"] == "SCRUM-77 perfil de integración"

        updated = client.patch("/usuarios/me", json={"ciudad": "Temuco"})
        assert updated.status_code == 200
        assert updated.headers["cache-control"] == "no-store"
        assert updated.json()["ciudad"] == "Temuco"

    persisted = repository.get_by_supabase_user_id(
        EXPECTED_IDENTITY.supabase_user_id
    )
    assert persisted is not None
    assert persisted.ciudad == "Temuco"
