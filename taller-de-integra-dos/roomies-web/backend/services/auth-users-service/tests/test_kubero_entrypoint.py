"""Kubero usa los contratos de identidad/perfil actuales y autenticacion real."""
import importlib

from fastapi.testclient import TestClient


def test_kubero_loads_current_identity_routes_without_local_flag(monkeypatch):
    from app import main

    try:
        with monkeypatch.context() as environment:
            environment.delenv("ROOMIES_LOCAL_MODE", raising=False)
            environment.setenv("ROOMIES_RUNTIME_MODE", "kubero")
            application = importlib.reload(main).app
            paths = set(application.openapi()["paths"])
            assert {"/api/usuarios/me", "/internal/v1/identidad", "/internal/notificaciones"} <= paths
            client = TestClient(application)
            try:
                assert client.get("/api/usuarios/me").status_code == 401
                assert client.get("/internal/v1/identidad").status_code == 401
            finally:
                client.close()
    finally:
        importlib.reload(main)
