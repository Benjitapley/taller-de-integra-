"""SCRUM-113: persistencia y reintentos reales en PostgreSQL desechable."""
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
import os
from uuid import uuid4

from fastapi.testclient import TestClient
import psycopg
import pytest

from app.main import app, reports, actor
from app.repository import ReportRepository
from app.service import Reports
from backend.service_runtime.contracts import Actor


class Relationships:
    def publication_owner(self, publication):
        return 1 if publication == 1 else None if publication == 999 else 90

    def related_users(self, user, target):
        return target == 2


@pytest.fixture(scope="module")
def database():
    dsn = os.environ.get("REPORTES_TEST_ADMIN_DSN")
    if not dsn:
        pytest.skip("Usar tests/run_isolated.py; nunca conectar una base existente.")
    with psycopg.connect(dsn, autocommit=True) as connection:
        for name in ("001_reportes.up.sql", "002_revision.up.sql", "003_envio_idempotente.up.sql"):
            connection.execute((Path(__file__).resolve().parents[1] / "migrations" / name).read_text(encoding="utf-8"), prepare=False)
    return dsn


@pytest.fixture
def scenario(database, monkeypatch):
    monkeypatch.setenv("REPORTES_CURSOR_SECRET", "isolated-report-cursor-" + "x" * 32)
    with psycopg.connect(database) as connection:
        connection.execute("TRUNCATE reportes.reporte, reportes.operacion_envio RESTART IDENTITY CASCADE")
    person = [Actor(uuid4(), 1, True)]
    app.dependency_overrides[actor] = lambda: person[0]
    app.dependency_overrides[reports] = lambda: Reports(ReportRepository(), Relationships())
    try:
        with TestClient(app) as client:
            yield client, person
    finally:
        app.dependency_overrides.clear()


BODY = {"categoria": "Conducta inapropiada", "descripcion": "Descripción ficticia", "id_publicacion_reportada": 42}


def send(client, key, body=None):
    return client.post("/api/reportes", headers={"Idempotency-Key": key}, json=body or BODY)


def test_persisted_replay_and_changed_body(scenario):
    client, person = scenario
    first = send(client, "operation-1")
    assert first.status_code == 201
    assert send(client, "operation-1").json() == first.json()
    changed = send(client, "operation-1", {**BODY, "descripcion": "Otro texto"})
    assert changed.status_code == 409
    assert len(client.get("/api/reportes/mios").json()["items"]) == 1
    # Otra sesión/objeto Repository consulta la referencia confirmada.
    assert ReportRepository().mine(1, 20, None)[0]["id_reporte"] == first.json()["id_reporte"]


def test_concurrent_duplicate_requests_insert_once(database):
    from app.models import ReportInput
    body = ReportInput(**BODY)
    with psycopg.connect(database) as connection:
        connection.execute("TRUNCATE reportes.reporte, reportes.operacion_envio RESTART IDENTITY CASCADE")
    def create(_):
        return Reports(ReportRepository(), Relationships()).create(1, body, "concurrent-operation")["id_reporte"]
    with ThreadPoolExecutor(6) as pool:
        ids = list(pool.map(create, range(12)))
    assert len(set(ids)) == 1
    assert len(ReportRepository().mine(1, 20, None)) == 1


def test_permissions_verified_email_and_private_history(scenario):
    client, person = scenario
    assert send(client, "own-listing", {**BODY, "id_publicacion_reportada": 1}).status_code == 403
    assert send(client, "missing", {**BODY, "id_publicacion_reportada": 999}).status_code == 404
    user = {"categoria": "Otro", "descripcion": "Ficticio", "id_usuario_reportado": 1}
    assert send(client, "self", user).status_code == 403
    assert send(client, "unrelated", {**user, "id_usuario_reportado": 3}).status_code == 403
    assert send(client, "related", {**user, "id_usuario_reportado": 2}).status_code == 201
    person[0] = Actor(uuid4(), 3, False)
    assert send(client, "unconfirmed").status_code == 403
    assert client.get("/api/reportes/mios").json()["items"] == []


def test_more_than_two_pages_state_refresh_and_cursor_scoped_to_user(scenario, database):
    client, person = scenario
    for i in range(43):
        assert send(client, f"page-{i}", {**BODY, "descripcion": f"Ficticio {i}"}).status_code == 201
    page = client.get("/api/reportes/mios").json()
    cursor = page["siguiente_cursor"]
    seen = [row["id_reporte"] for row in page["items"]]
    assert len(seen) == 20 and cursor
    person[0] = Actor(uuid4(), 2, True)
    assert client.get("/api/reportes/mios", params={"cursor": cursor}).status_code == 422
    assert client.get("/api/reportes/mios").json()["items"] == []
    person[0] = Actor(uuid4(), 1, True)
    while cursor:
        response = client.get("/api/reportes/mios", params={"cursor": cursor})
        assert response.status_code == 200
        page = response.json()
        seen.extend(row["id_reporte"] for row in page["items"])
        cursor = page["siguiente_cursor"]
    assert len(seen) == len(set(seen)) == 43
    with psycopg.connect(database) as connection:
        connection.execute("UPDATE reportes.reporte SET estado='En_Revision' WHERE id_reporte=%s", (seen[0],))
        connection.execute("INSERT INTO reportes.reporte_historial(id_reporte,id_administrador,estado_anterior,estado_nuevo,nota_interna) VALUES(%s,90,'Pendiente','En_Revision','NOTA PRIVADA')", (seen[0],))
    refreshed = client.get("/api/reportes/mios")
    assert refreshed.json()["items"][0]["estado"] == "En_Revision"
    assert "NOTA PRIVADA" not in refreshed.text
    assert "id_denunciante" not in refreshed.text


def test_e06_admin_three_pages_ties_filters_and_cursor_context(scenario, database):
    from app.main import admin_actor
    client, _ = scenario
    app.dependency_overrides[admin_actor] = lambda: Actor(uuid4(), 90, True, True)
    with psycopg.connect(database) as connection:
        connection.execute("""INSERT INTO reportes.reporte
            (id_denunciante,id_publicacion_reportada,categoria,descripcion,estado,fecha)
            SELECT 1,42,'E06','Volumen ficticio','Pendiente','2026-11-26T12:00:00Z'
            FROM generate_series(1,53)""")
        connection.execute("""INSERT INTO reportes.reporte
            (id_denunciante,id_usuario_reportado,categoria,descripcion,estado,fecha)
            SELECT 1,2,'E06','Fuera del filtro','En_Revision','2026-11-26T12:00:00Z'
            FROM generate_series(1,25)""")
    ids, cursor, pages, first = [], None, 0, None
    while True:
        result = client.get("/api/admin/reportes", params={"estado": "Pendiente", "tipo": "Publicacion", **({"cursor": cursor} if cursor else {})})
        assert result.status_code == 200, result.text
        page = result.json()
        ids.extend(row["id_reporte"] for row in page["items"])
        cursor = page["siguiente_cursor"]
        first = first or cursor
        pages += 1
        if cursor is None:
            break
    assert pages == 3 and len(ids) == len(set(ids)) == 53 and ids == sorted(ids, reverse=True)
    for query in ({"estado": "En_Revision", "tipo": "Publicacion"}, {"estado": "Pendiente", "tipo": "Usuario"}):
        assert client.get("/api/admin/reportes", params={**query, "cursor": first}).status_code == 422
    assert client.get("/api/reportes/mios", params={"cursor": first}).status_code == 422


def test_operation_key_validation_and_same_key_isolated_between_accounts(scenario):
    client, person = scenario
    assert send(client, "bad key").status_code == 422
    assert send(client, "x" * 81).status_code == 422
    first = send(client, "shared-key").json()
    person[0] = Actor(uuid4(), 2, True)
    second = send(client, "shared-key").json()
    assert first["id_reporte"] != second["id_reporte"]
