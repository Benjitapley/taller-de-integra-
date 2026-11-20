import json
import time
from unittest.mock import Mock
from uuid import uuid4

import httpx
import jwt
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient

from app.main import actor, app, reports
from app.notifications import NotificationDelivery
from app.relationships import Relationships
from app.service import Reports
from backend.service_runtime.contracts import Actor
from backend.service_runtime.reporting_security import report_service_token, verify_report_service


@pytest.fixture
def unavailable_reports(monkeypatch):
    monkeypatch.setenv("ROOMIES_LOCAL_MODE", "1")
    monkeypatch.setenv("LISTADO_UPSTREAM_URL", "http://127.0.0.1:9980")
    monkeypatch.setenv("REPORTES_LISTADO_JWT_KEY", "fixture-listado-" * 3)
    repository = Mock()

    def send(request):
        verify_report_service(request.headers["Authorization"], "listado-applications", "REPORTES_LISTADO_JWT_KEY")
        assert request.url.path == "/internal/publicaciones/42"
        return httpx.Response(404, json={"detail": "Not Found"})

    domain = Reports(repository, Relationships(httpx.MockTransport(send)))
    app.dependency_overrides[actor] = lambda: Actor(uuid4(), 1, True)
    app.dependency_overrides[reports] = lambda: domain
    try:
        with TestClient(app) as client:
            yield client, repository
    finally:
        app.dependency_overrides.clear()


def test_missing_internal_route_is_dependency_failure_before_insert(unavailable_reports):
    client, repository = unavailable_reports
    response = client.post("/api/reportes", json={
        "categoria": "Aviso", "descripcion": "Contenido ficticio", "id_publicacion_reportada": 42,
    })
    assert response.status_code == 503
    assert response.json()["codigo"] == "DEPENDENCIA_NO_DISPONIBLE"
    repository.create.assert_not_called()


def test_service_token_checks_audience_and_lifetime(monkeypatch):
    key = "fixture-secreto-" * 3
    monkeypatch.setenv("TEST_KEY", key)
    token = report_service_token("match-conexion", "TEST_KEY")
    verify_report_service(f"Bearer {token}", "match-conexion", "TEST_KEY")
    with pytest.raises(HTTPException) as error:
        verify_report_service(f"Bearer {token}", "listado-applications", "TEST_KEY")
    assert error.value.status_code == 403

    now = int(time.time())
    token = jwt.encode({"iss": "reportes", "aud": "match-conexion", "iat": now, "exp": now + 61}, key, algorithm="HS256")
    with pytest.raises(HTTPException) as error:
        verify_report_service(f"Bearer {token}", "match-conexion", "TEST_KEY")
    assert error.value.status_code == 403


def test_failed_notification_is_retried_with_same_key_and_without_internal_note(monkeypatch):
    monkeypatch.setenv("ROOMIES_LOCAL_MODE", "1")
    monkeypatch.setenv("AUTH_USERS_UPSTREAM_URL", "http://127.0.0.1:9980")
    monkeypatch.setenv("REPORTES_AUTH_JWT_KEY", "fixture-auth-" * 3)
    repo = Mock()
    repo.next_notification.return_value = {"id_actuacion": 5, "id_usuario": 3, "referencia_id": 9,
                                           "estado": "En_Revision", "nota_interna": "Privada"}
    replies = iter([httpx.Response(503), httpx.Response(200, json={"success": True})])

    def send(request):
        verify_report_service(request.headers["Authorization"], "auth-users", "REPORTES_AUTH_JWT_KEY")
        assert request.url.path == "/internal/notificaciones"
        assert request.headers["Idempotency-Key"] == "reporte_actualizado:5"
        assert json.loads(request.content) == {"event_key": "reporte_actualizado:5", "tipo": "reporte_actualizado",
                                              "id_usuario": 3, "referencia_id": 9, "estado": "En_Revision"}
        return next(replies)

    delivery = NotificationDelivery(repo, httpx.MockTransport(send))
    assert delivery.deliver_next()
    repo.mark_delivered.assert_not_called()
    assert delivery.deliver_next()
    repo.mark_delivered.assert_called_once_with(5)
