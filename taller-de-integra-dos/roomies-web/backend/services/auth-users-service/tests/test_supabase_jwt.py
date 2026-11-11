from types import SimpleNamespace
from uuid import UUID
import json

import jwt
import pytest
from fastapi import HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.api.dependencies import get_current_identity, get_jwt_verifier
from app.domain.identity import VerifiedIdentity
from app.infrastructure.security import supabase_jwt
from app.infrastructure.security.supabase_jwt import (
    IdentityProviderUnavailable,
    InvalidAccessToken,
    SupabaseJWTVerifier,
)
from app.infrastructure.settings import SettingsError, SupabaseJWTSettings
from app.main import app


def settings(**overrides):
    values = {
        "jwks_url": "https://project.example/auth/v1/.well-known/jwks.json",
        "issuer": "https://project.example/auth/v1",
        "audience": "roomies-test-audience",
        "algorithms": ("ES256",),
    }
    values.update(overrides)
    return SupabaseJWTSettings(**values)


class FakeKeyResolver:
    def __init__(self, result=None, error=None):
        self.result = result or SimpleNamespace(key="public-key-fixture")
        self.error = error
        self.calls = []

    def get_signing_key_from_jwt(self, token):
        self.calls.append(token)
        if self.error:
            raise self.error
        return self.result


def test_settings_derive_issuer_and_jwks_from_supabase_url():
    configured = SupabaseJWTSettings.from_environment(
        {
            "SUPABASE_URL": "https://team-project.example/",
            "SUPABASE_JWT_AUDIENCE": "roomies-audience",
            "SUPABASE_JWT_ALGORITHMS": "ES256",
        }
    )

    assert configured.issuer == "https://team-project.example/auth/v1"
    assert configured.jwks_url == "https://team-project.example/auth/v1/.well-known/jwks.json"
    assert configured.algorithms == ("ES256",)


@pytest.mark.parametrize(
    "environment",
    [
        {},
        {"SUPABASE_URL": "https://team-project.example"},
        {
            "SUPABASE_URL": "https://team-project.example",
            "SUPABASE_JWT_AUDIENCE": "roomies",
            "SUPABASE_JWT_ALGORITHMS": "HS256",
        },
    ],
)
def test_settings_fail_closed_when_required_or_safe_configuration_is_missing(environment):
    with pytest.raises(SettingsError):
        SupabaseJWTSettings.from_environment(environment)


def test_settings_reject_jwks_url_with_user_controlled_destination_parts():
    with pytest.raises(SettingsError):
        SupabaseJWTSettings.from_environment(
            {
                "SUPABASE_URL": "https://team-project.example",
                "SUPABASE_JWT_AUDIENCE": "roomies",
                "SUPABASE_JWT_ALGORITHMS": "RS256",
                "SUPABASE_JWKS_URL": "https://user:pass@attacker.example/keys",
            }
        )


def test_verifier_returns_only_the_validated_supabase_uuid(monkeypatch):
    captured = {}
    resolver = FakeKeyResolver()
    expected_id = UUID("1786a4dd-f811-4cc0-8ed2-a4e6eb9db131")

    def decode(token, key, **kwargs):
        captured.update({"token": token, "key": key, **kwargs})
        return {
            "sub": str(expected_id),
            "iss": "https://project.example/auth/v1",
            "aud": "roomies-test-audience",
            "exp": 2_000_000_000,
            "iat": 1_900_000_000,
        }

    monkeypatch.setattr(supabase_jwt.jwt, "decode", decode)
    identity = SupabaseJWTVerifier(settings(), resolver).verify("signed-token-fixture")

    assert identity == VerifiedIdentity(supabase_user_id=expected_id)
    assert resolver.calls == ["signed-token-fixture"]
    assert captured["key"] == "public-key-fixture"
    assert captured["algorithms"] == ["ES256"]
    assert captured["issuer"] == "https://project.example/auth/v1"
    assert captured["audience"] == "roomies-test-audience"
    assert captured["options"]["require"] == ["sub", "iss", "aud", "exp", "iat"]


def test_verifier_rejects_noncanonical_or_invalid_uuid_subject(monkeypatch):
    resolver = FakeKeyResolver()
    monkeypatch.setattr(
        supabase_jwt.jwt,
        "decode",
        lambda *_args, **_kwargs: {
            "sub": "not-a-uuid",
            "iss": "https://project.example/auth/v1",
            "aud": "roomies-test-audience",
            "exp": 2_000_000_000,
            "iat": 1_900_000_000,
        },
    )

    with pytest.raises(InvalidAccessToken):
        SupabaseJWTVerifier(settings(), resolver).verify("signed-token-fixture")


def test_verifier_maps_invalid_signature_to_401_classification(monkeypatch):
    monkeypatch.setattr(
        supabase_jwt.jwt,
        "decode",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(jwt.InvalidSignatureError("invalid")),
    )

    with pytest.raises(InvalidAccessToken):
        SupabaseJWTVerifier(settings(), FakeKeyResolver()).verify("signed-token-fixture")


def test_verifier_maps_jwks_connection_failure_to_recoverable_unavailability():
    resolver = FakeKeyResolver(error=jwt.PyJWKClientConnectionError("offline"))

    with pytest.raises(IdentityProviderUnavailable):
        SupabaseJWTVerifier(settings(), resolver).verify("signed-token-fixture")


def test_verifier_maps_malformed_token_to_invalid_without_fetching_jwks(monkeypatch):
    resolver = jwt.PyJWKClient(settings().jwks_url)

    def unexpected_fetch():
        pytest.fail("Un token malformado no debe provocar una llamada a JWKS.")

    monkeypatch.setattr(resolver, "fetch_data", unexpected_fetch)
    with pytest.raises(InvalidAccessToken):
        SupabaseJWTVerifier(settings(), resolver).verify("not-a-jwt")


@pytest.mark.parametrize(
    "resolver_error",
    [
        jwt.PyJWKSetError("unusable JWKS"),
        json.JSONDecodeError("invalid JSON", "{", 0),
    ],
)
def test_verifier_maps_unusable_jwks_to_provider_unavailable(resolver_error):
    resolver = FakeKeyResolver(error=resolver_error)

    with pytest.raises(IdentityProviderUnavailable):
        SupabaseJWTVerifier(settings(), resolver).verify("signed-token-fixture")


def test_verifier_maps_unknown_kid_to_invalid_token():
    resolver = FakeKeyResolver(error=jwt.PyJWKClientError("unknown kid"))

    with pytest.raises(InvalidAccessToken):
        SupabaseJWTVerifier(settings(), resolver).verify("signed-token-fixture")


def test_verifier_rejects_oversized_token_before_resolving_keys():
    resolver = FakeKeyResolver()

    with pytest.raises(InvalidAccessToken):
        SupabaseJWTVerifier(settings(max_token_length=8), resolver).verify("x" * 9)
    assert resolver.calls == []


def test_http_dependency_requires_bearer_and_maps_provider_failure():
    with pytest.raises(HTTPException) as missing:
        get_current_identity(credentials=None, verifier=SimpleNamespace())
    assert missing.value.status_code == 401
    assert missing.value.headers["WWW-Authenticate"] == "Bearer"

    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="opaque")
    failing_verifier = SimpleNamespace(
        verify=lambda _token: (_ for _ in ()).throw(IdentityProviderUnavailable())
    )
    with pytest.raises(HTTPException) as unavailable:
        get_current_identity(credentials=credentials, verifier=failing_verifier)
    assert unavailable.value.status_code == 503


def test_http_dependency_maps_invalid_token_to_401():
    credentials = HTTPAuthorizationCredentials(scheme="Bearer", credentials="opaque")
    invalid_verifier = SimpleNamespace(
        verify=lambda _token: (_ for _ in ()).throw(InvalidAccessToken())
    )

    with pytest.raises(HTTPException) as invalid:
        get_current_identity(credentials=credentials, verifier=invalid_verifier)

    assert invalid.value.status_code == 401
    assert invalid.value.headers["WWW-Authenticate"] == "Bearer"


def test_http_dependency_maps_missing_supabase_configuration_to_503(monkeypatch):
    monkeypatch.setattr(
        "app.api.dependencies.get_jwt_settings",
        lambda: (_ for _ in ()).throw(SettingsError("missing test config")),
    )

    with pytest.raises(HTTPException) as unavailable:
        get_jwt_verifier.__wrapped__()
    assert unavailable.value.status_code == 503


def test_app_exposes_health_without_external_services():
    assert set(app.openapi()["paths"]["/health"]) == {"get"}
