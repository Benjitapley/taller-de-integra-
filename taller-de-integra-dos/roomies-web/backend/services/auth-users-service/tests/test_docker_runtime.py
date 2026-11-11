"""Safe HTTP smoke checks; no PostgreSQL, Supabase, or SMTP is contacted."""

import pytest
from fastapi.testclient import TestClient

from app.api.dependencies import (
    get_jwt_settings,
    get_jwt_verifier,
    get_profile_repository,
)
from app.main import app


_EXTERNAL_CONFIGURATION = (
    "SUPABASE_URL",
    "SUPABASE_JWT_AUDIENCE",
    "SUPABASE_JWT_ALGORITHMS",
    "SUPABASE_JWT_ISSUER",
    "SUPABASE_JWKS_URL",
    "SUPABASE_JWKS_TIMEOUT_SECONDS",
    "SUPABASE_JWKS_CACHE_SECONDS",
    "AUTH_USERS_DATABASE_URL",
    "AUTH_USERS_DATABASE_ENVIRONMENT",
)


@pytest.fixture
def client_without_external_configuration(monkeypatch):
    for name in _EXTERNAL_CONFIGURATION:
        monkeypatch.delenv(name, raising=False)

    def unexpected_repository_access():
        raise AssertionError("El smoke test no debe consultar PostgreSQL.")

    monkeypatch.setitem(
        app.dependency_overrides,
        get_profile_repository,
        unexpected_repository_access,
    )
    get_jwt_settings.cache_clear()
    get_jwt_verifier.cache_clear()
    try:
        with TestClient(app) as client:
            yield client
    finally:
        get_jwt_settings.cache_clear()
        get_jwt_verifier.cache_clear()


def test_health_and_docs_are_available_without_external_services(
    client_without_external_configuration,
):
    health = client_without_external_configuration.get("/health")
    docs = client_without_external_configuration.get("/docs")

    assert health.status_code == 200
    assert health.json() == {"status": "ok"}
    assert docs.status_code == 200


def test_private_profile_fails_closed_without_identity_configuration(
    client_without_external_configuration,
):
    response = client_without_external_configuration.get("/usuarios/me")

    assert response.status_code == 503
    assert response.headers["cache-control"] == "no-store"
    assert response.json() == {
        "detail": "La verificación de identidad no está configurada."
    }
