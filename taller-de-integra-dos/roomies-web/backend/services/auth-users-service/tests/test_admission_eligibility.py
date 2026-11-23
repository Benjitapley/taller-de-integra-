from types import SimpleNamespace
from unittest.mock import Mock
from uuid import UUID

from fastapi import FastAPI
from fastapi.testclient import TestClient
import httpx
import pytest

from app.api.routes.local_users import router, users, admission_identity
from app.infrastructure.security.admission_provider import SupabaseAdmissionIdentity
from backend.service_runtime.contracts import DependencyUnavailable
from backend.service_runtime.http import configure

SUBJECT = UUID("29acfc24-34de-4814-b1e6-566f1f6162b3")
TOKEN = "synthetic-internal-admission-key-000000000"
ADMIN_KEY = "sb_secret_synthetic-admin-admission-key-000"
IDENTITY = {"id": str(SUBJECT), "email": "qa@example.test", "email_confirmed_at": "2026-11-01T00:00:00Z", "is_anonymous": False}


@pytest.fixture
def provider(monkeypatch):
    monkeypatch.setenv("ROOMIES_SUPABASE_AUTH_ADMIN_KEY", ADMIN_KEY)
    monkeypatch.setattr("app.infrastructure.security.admission_provider.auth_provider_url", lambda: "https://example.supabase.co")
    responses = {"status": 200, "body": IDENTITY.copy()}
    requests = []
    original = httpx.Client
    def handler(request):
        requests.append(request)
        if responses.get("failure"):
            raise httpx.ConnectError("private upstream credentials", request=request)
        return httpx.Response(responses["status"], json=responses["body"])
    def client(**options):
        assert options == {"timeout": 5, "trust_env": False, "follow_redirects": False}
        return original(**options, transport=httpx.MockTransport(handler))
    monkeypatch.setattr(httpx, "Client", client)
    return SupabaseAdmissionIdentity(), responses, requests


def test_admin_checks_actual_identity_and_keeps_key_backend_only(provider):
    port, _, requests = provider
    assert port.enabled(SUBJECT)
    assert requests[0].url.path == f"/auth/v1/admin/users/{SUBJECT}"
    assert requests[0].headers["apikey"] == ADMIN_KEY
    assert "authorization" not in requests[0].headers


@pytest.mark.parametrize("changes", [{"email_confirmed_at": None}, {"email": ""}, {"is_anonymous": True},
    {"deleted_at": "2026-11-01T00:00:00Z"}, {"banned_until": "2999-01-01T00:00:00Z"}])
def test_unconfirmed_anonymous_deleted_or_banned_are_not_enabled(provider, changes):
    port, response, _ = provider
    response["body"].update(changes)
    assert port.enabled(SUBJECT) is False


def test_missing_account_false_and_expired_ban_enabled(provider):
    port, response, _ = provider
    response["status"] = 404
    assert port.enabled(SUBJECT) is False
    response.update(status=200, body={**IDENTITY, "banned_until": "2000-01-01T00:00:00Z"})
    assert port.enabled(SUBJECT)


@pytest.mark.parametrize("body", [None, [], {}, {**IDENTITY,"id":str(UUID(int=1))}, {**IDENTITY,"email_confirmed_at":"not-a-date"}, {**IDENTITY,"banned_until":True}])
def test_malformed_provider_does_not_invent_eligibility(provider, body):
    port, response, _ = provider
    response["body"] = body
    with pytest.raises(DependencyUnavailable): port.enabled(SUBJECT)


@pytest.mark.parametrize("status", [401, 403, 429, 503, 302])
def test_dependency_failure_is_503_semantics(provider,status):
    port,response,_ = provider
    response["status"] = status
    with pytest.raises(DependencyUnavailable): port.enabled(SUBJECT)


def test_network_and_missing_config_fail_closed(provider, monkeypatch):
    port,response,requests = provider
    response["failure"] = True
    with pytest.raises(DependencyUnavailable): port.enabled(SUBJECT)
    monkeypatch.delenv("ROOMIES_SUPABASE_AUTH_ADMIN_KEY")
    with pytest.raises(DependencyUnavailable): port.enabled(SUBJECT)
    assert len(requests) == 1


@pytest.fixture
def web(monkeypatch):
    monkeypatch.setenv("ROOMIES_INTERNAL_TOKEN",TOKEN)
    repository,provider = Mock(),Mock()
    repository.get_by_id.return_value = SimpleNamespace(supabase_user_id=SUBJECT)
    provider.enabled.return_value = True
    app=FastAPI()
    configure(app)
    app.include_router(router)
    app.dependency_overrides[users] = lambda:SimpleNamespace(repository=repository)
    app.dependency_overrides[admission_identity] = lambda:provider
    return TestClient(app),repository,provider


def test_endpoint_checks_service_before_identity_and_returns_only_contract(web):
    client,repository,provider=web
    assert client.get("/internal/v1/usuarios/2/habilitacion").status_code == 403
    repository.get_by_id.assert_not_called()
    response=client.get("/internal/v1/usuarios/2/habilitacion",headers={"X-Roomies-Service":TOKEN})
    assert response.json()=={"id_usuario":2,"habilitado":True}
    assert response.headers["cache-control"]=="no-store"
    provider.enabled.assert_called_once_with(SUBJECT)


def test_endpoint_missing_or_unlinked_user_does_not_call_provider(web):
    client,repository,provider=web
    for user in [None,SimpleNamespace(supabase_user_id=None)]:
        repository.get_by_id.return_value=user
        assert client.get("/internal/v1/usuarios/2/habilitacion",headers={"X-Roomies-Service":TOKEN}).json()=={"id_usuario":2,"habilitado":False}
    provider.enabled.assert_not_called()


def test_endpoint_provider_failure_is_503_not_disabled(web):
    client,_,provider=web
    provider.enabled.side_effect=DependencyUnavailable()
    assert client.get("/internal/v1/usuarios/2/habilitacion",headers={"X-Roomies-Service":TOKEN}).status_code==503
