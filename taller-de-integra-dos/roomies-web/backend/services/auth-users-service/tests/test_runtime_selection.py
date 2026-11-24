from pathlib import Path
import runpy
from unittest.mock import Mock

import psycopg
import pytest

from app.api.routes import local_users
from app.infrastructure.persistence.local_users import PostgresUsers
from backend.service_runtime.contracts import DependencyUnavailable


MAIN = Path(__file__).resolve().parents[1] / "app" / "main.py"
TEST_DSN = (
    "postgresql://sql_auth_users:synthetic@roomies-db-test2-postgres:5432/"
    "roomies-db-test2?sslmode=disable&gssencmode=disable"
)


@pytest.mark.parametrize("mode,local,shared", [
    ("kubero", None, True),
    ("supabase", None, True),
    ("disposable", "1", True),
    (None, None, False),
    ("disposable", None, False),
])
def test_app_routes_by_runtime(monkeypatch, mode, local, shared):
    for name, value in (("ROOMIES_RUNTIME_MODE", mode), ("ROOMIES_LOCAL_MODE", local)):
        if value is None:
            monkeypatch.delenv(name, raising=False)
        else:
            monkeypatch.setenv(name, value)

    app = runpy.run_path(str(MAIN))["app"]
    paths = app.openapi()["paths"]
    assert "/health" in paths
    assert "/usuarios/me" in paths
    assert ("/api/usuarios/me" in paths) is shared
    assert ("/api/usuarios/me/foto" in paths) is shared
    assert ("/internal/v1/identidad" in paths) is shared
    if shared:
        assert isinstance(local_users.users().repository, PostgresUsers)
        assert set(paths["/api/usuarios/me"]) == {"get", "patch", "post"}


@pytest.fixture
def sql_connector(monkeypatch):
    for name, value in {
        "ROOMIES_RUNTIME_MODE": "kubero",
        "ROOMIES_LOCAL_MODE": "0",
        "ROOMIES_SUPABASE_PROJECT_REF": "a" * 20,
        "ROOMIES_DEPLOYMENT_ENV": "test",
        "ROOMIES_KUBERO_ALLOW_INSECURE_TEST_DB": "true",
        "ROOMIES_KUBERO_DB_HOST": "roomies-db-test2-postgres",
        "ROOMIES_KUBERO_DB_PORT": "5432",
        "ROOMIES_KUBERO_DB_NAME": "roomies-db-test2",
        "DB_SSLMODE": "disable",
        "AUTH_USERS_DATABASE_URL": TEST_DSN,
    }.items():
        monkeypatch.setenv(name, value)
    connector = Mock()
    monkeypatch.setattr(psycopg, "connect", connector)
    return connector


def test_repository_accepts_exact_kubero_test_exception(sql_connector):
    repository = local_users.users().repository
    assert repository.connect() is sql_connector.return_value
    sql_connector.assert_called_once_with(
        TEST_DSN, row_factory=psycopg.rows.dict_row, connect_timeout=3, prepare_threshold=None
    )


@pytest.mark.parametrize("overrides", [
    {"ROOMIES_DEPLOYMENT_ENV": "production"},
    {"ROOMIES_KUBERO_ALLOW_INSECURE_TEST_DB": "false"},
    {"ROOMIES_RUNTIME_MODE": "supabase"},
    {"ROOMIES_LOCAL_MODE": "1"},
    {"AUTH_USERS_DATABASE_URL": TEST_DSN.replace("sql_auth_users", "sql_match_conexion")},
    {
        "ROOMIES_KUBERO_DB_HOST": "otro-postgres",
        "AUTH_USERS_DATABASE_URL": TEST_DSN.replace("roomies-db-test2-postgres", "otro-postgres"),
    },
    {
        "ROOMIES_KUBERO_DB_PORT": "5433",
        "AUTH_USERS_DATABASE_URL": TEST_DSN.replace(":5432/", ":5433/"),
    },
    {"AUTH_USERS_DATABASE_URL": TEST_DSN.replace("/roomies-db-test2?", "/otra-base?")},
    {"AUTH_USERS_DATABASE_URL": TEST_DSN.replace("&gssencmode=disable", "")},
])
def test_repository_rejects_unauthorized_dsn_before_connecting(monkeypatch, sql_connector, overrides):
    for name, value in overrides.items():
        monkeypatch.setenv(name, value)
    with pytest.raises(DependencyUnavailable):
        local_users.users().repository.connect()
    sql_connector.assert_not_called()
