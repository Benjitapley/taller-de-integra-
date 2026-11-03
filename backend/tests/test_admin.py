import pytest
import psycopg
import jwt
from backend.auth_service import database
from backend.auth_service.config import get_settings
from test_auth import verified_login


@pytest.mark.parametrize("path", ["/api/admin/resumen", "/api/admin/publicaciones"])
def test_admin_requires_session(client, path):
    response = client.get(path)
    assert response.status_code == 401
    assert response.headers["cache-control"] == "no-store"


def test_admin_denies_profile_and_role_claims(client, payload, mail, monkeypatch, db):
    headers = verified_login(client, payload, mail)
    monkeypatch.delenv("ADMIN_USER_IDS", raising=False)
    headers.update({"X-Role": "admin", "X-User-Id": "1"})
    for path in ("/api/admin/resumen?role=admin", "/api/admin/publicaciones?id_usuario=1"):
        assert client.get(path, headers=headers).status_code == 403
    monkeypatch.setenv("ADMIN_USER_IDS", "2")
    assert client.get("/api/admin/resumen", headers=headers).status_code == 403
    settings = get_settings()
    claims = jwt.decode(headers["Authorization"][7:], settings.jwt_secret, algorithms=["HS256"], audience=settings.audience)
    claims.update(role="admin", is_admin=True)
    role_headers = {"Authorization": "Bearer " + jwt.encode(claims, settings.jwt_secret, algorithm="HS256")}
    assert client.get("/api/admin/resumen", headers=role_headers).status_code == 403
    assert not any("select (select count" in query for query, _ in db.calls)
    monkeypatch.setenv("ADMIN_USER_IDS", "1,invalid")
    assert client.get("/api/admin/resumen", headers=headers).status_code == 503


def test_admin_validation_and_no_mutations(client, payload, mail, monkeypatch):
    headers = verified_login(client, payload, mail)
    monkeypatch.setenv("ADMIN_USER_IDS", "1")
    for query in ("limite=0", "limite=101", "pagina=0", "pagina=100001", "pagina=texto"):
        assert client.get("/api/admin/publicaciones?" + query, headers=headers).status_code == 422
    for method in ("post", "put", "delete", "patch"):
        assert getattr(client, method)("/api/admin/resumen", headers=headers).status_code == 405
    monkeypatch.setenv("ADMIN_USER_IDS", "")
    assert client.get("/api/admin/resumen", headers=headers).status_code == 403


def test_admin_database_failure_is_sanitized(client, payload, mail, monkeypatch):
    headers = verified_login(client, payload, mail)
    monkeypatch.setenv("ADMIN_USER_IDS", "1")
    original = database.conectar
    calls = 0
    def connect():
        nonlocal calls
        calls += 1
        if calls == 1:
            return original()  # La sesión sigue validándose con el mecanismo real.
        raise psycopg.OperationalError("database-private-secret")
    monkeypatch.setattr(database, "conectar", connect)
    response = client.get("/api/admin/resumen", headers=headers)
    assert response.status_code == 503
    assert "database-private-secret" not in response.text
