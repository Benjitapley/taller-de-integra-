from fastapi.testclient import TestClient

from backend.auth_service.app import app


def test_independent_auth_app_health_returns_ok_over_http():
    with TestClient(app) as client:
        response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok"}


def test_independent_app_keeps_existing_auth_routes_and_methods():
    routes = app.openapi()["paths"]

    assert set(routes["/auth/registro"]) == {"post"}
    assert set(routes["/auth/verificar"]) == {"post"}
    assert set(routes["/auth/reenviar-codigo"]) == {"post"}
    assert set(routes["/auth/login"]) == {"post"}
    assert set(routes["/auth/logout"]) == {"post"}
