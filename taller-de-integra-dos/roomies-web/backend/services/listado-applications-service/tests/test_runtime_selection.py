from unittest.mock import Mock
from uuid import UUID

from fastapi import HTTPException
import httpx
import psycopg
import pytest

from app.api.routes import service
from app.infrastructure.clients import HttpIncorporations
from app.infrastructure.repository import PostgresPublications
from backend.service_runtime import security
from backend.service_runtime.contracts import DependencyUnavailable


PROJECT = "a" * 20
AUTH_ORIGIN = f"https://{PROJECT}.supabase.co"
SUBJECT = "86e304ce-09fb-41c6-bcaf-4d5512668441"
INCORPORATION_KEY = "08864c0e-fb98-451a-bfd3-b92ed5e13b54"
INCORPORATION = {"id_postulacion": 9, "id_publicacion": 7, "id_usuario": 2, "version_capacidad": 1}
INTERNAL_TOKEN = "synthetic-service-token-for-local-tests"
STORAGE_KEY = "sb_secret_synthetic-storage-key"
TEST_DSN = (
    "postgresql://sql_listado_applications:synthetic@roomies-db-test2-postgres:5432/"
    "roomies-db-test2?sslmode=disable&gssencmode=disable"
)


@pytest.fixture(autouse=True)
def kubero_test(monkeypatch):
    for name in ("PGHOSTADDR", "PGSERVICE", "ROOMIES_JWT_ISSUER"):
        monkeypatch.delenv(name, raising=False)
    for name, value in {
        "ROOMIES_RUNTIME_MODE": "kubero",
        "ROOMIES_LOCAL_MODE": "0",
        "ROOMIES_DEPLOYMENT_ENV": "test",
        "ROOMIES_PERSISTENCE_LAYOUT": "private-v1",
        "ROOMIES_KUBERO_ALLOW_INSECURE_TEST_DB": "true",
        "ROOMIES_KUBERO_DB_HOST": "roomies-db-test2-postgres",
        "ROOMIES_KUBERO_DB_PORT": "5432",
        "ROOMIES_KUBERO_DB_NAME": "roomies-db-test2",
        "DB_SSLMODE": "disable",
        "LISTADO_DATABASE_URL": TEST_DSN,
        "ROOMIES_SUPABASE_PROJECT_REF": PROJECT,
        "ROOMIES_AUTH_PROVIDER_URL": AUTH_ORIGIN,
        "AUTH_USERS_UPSTREAM_URL": "http://auth-users:8000",
        "CONVIVENCIA_UPSTREAM_URL": "http://convivencia-mensajeria:8000",
        "ROOMIES_INTERNAL_TOKEN": INTERNAL_TOKEN,
        "ROOMIES_SUPABASE_STORAGE_KEY": STORAGE_KEY,
    }.items():
        monkeypatch.setenv(name, value)


@pytest.fixture
def sql_connector(monkeypatch):
    connect = Mock()
    monkeypatch.setattr(psycopg, "connect", connect)
    return connect


@pytest.fixture
def http_handler(monkeypatch):
    original = httpx.Client
    handler = Mock(side_effect=AssertionError("Solicitud HTTP inesperada"))

    def client(**kwargs):
        return original(transport=httpx.MockTransport(handler), **kwargs)

    monkeypatch.setattr(httpx, "Client", client)
    return handler


@pytest.fixture
def jwks(monkeypatch):
    security.verifier.cache_clear()
    jwks = Mock()
    jwks.return_value.get_signing_key_from_jwt.return_value.key = object()
    decode = Mock(return_value={"sub": SUBJECT})
    monkeypatch.setattr(security.jwt, "PyJWKClient", jwks)
    monkeypatch.setattr(security.jwt, "decode", decode)
    yield jwks, decode
    security.verifier.cache_clear()


def test_listado_uses_shared_postgres_policy(sql_connector):
    repository = service().repository
    assert isinstance(repository, PostgresPublications)
    assert repository.connect() is sql_connector.return_value
    sql_connector.assert_called_once_with(
        TEST_DSN, row_factory=psycopg.rows.dict_row, connect_timeout=3, prepare_threshold=None
    )


@pytest.mark.parametrize("setting,value", [
    ("LISTADO_DATABASE_URL", TEST_DSN.replace("sql_listado_applications", "sql_auth_users")),
    ("LISTADO_DATABASE_URL", TEST_DSN.replace("roomies-db-test2-postgres", "other-postgres")),
    ("LISTADO_DATABASE_URL", TEST_DSN.replace(":5432/", ":5433/")),
    ("LISTADO_DATABASE_URL", TEST_DSN.replace("/roomies-db-test2?", "/other-db?")),
    ("ROOMIES_DEPLOYMENT_ENV", "production"),
    ("ROOMIES_KUBERO_ALLOW_INSECURE_TEST_DB", "false"),
])
def test_listado_rejects_unauthorized_test_dsn(monkeypatch, sql_connector, setting, value):
    monkeypatch.setenv(setting, value)
    with pytest.raises(DependencyUnavailable):
        service().repository.connect()
    sql_connector.assert_not_called()


def test_actor_uses_configured_supabase_and_private_auth(http_handler, jwks):
    client_factory, decode = jwks
    token = "synthetic-user-token"
    http_handler.side_effect = None
    http_handler.return_value = httpx.Response(
        200, json={"subject": SUBJECT, "user_id": 2, "email_confirmed": True, "administrator": False}
    )

    identity = security.confirmed_actor(security.actor(token))

    assert identity.subject == UUID(SUBJECT)
    assert identity.user_id == 2
    client_factory.assert_called_once_with(
        f"{AUTH_ORIGIN}/auth/v1/.well-known/jwks.json", timeout=3, lifespan=60
    )
    assert decode.call_args.kwargs["issuer"] == f"{AUTH_ORIGIN}/auth/v1"
    assert decode.call_args.kwargs["audience"] == "authenticated"
    request, = http_handler.call_args.args
    assert request.method == "GET"
    assert str(request.url) == "http://auth-users:8000/internal/v1/identidad"
    assert request.headers["authorization"] == f"Bearer {token}"


@pytest.mark.parametrize("setting,value", [
    ("AUTH_USERS_UPSTREAM_URL", "http://otro-servicio:8000"),
    ("ROOMIES_AUTH_PROVIDER_URL", "https://otro-proyecto.supabase.co"),
    ("ROOMIES_JWT_ISSUER", "https://otro-proyecto.supabase.co/auth/v1"),
])
def test_actor_rejects_unapproved_destinations(monkeypatch, http_handler, jwks, setting, value):
    monkeypatch.setenv(setting, value)
    with pytest.raises(HTTPException) as error:
        security.actor("synthetic-user-token")
    assert error.value.status_code == 503
    http_handler.assert_not_called()
    if setting != "AUTH_USERS_UPSTREAM_URL":
        jwks[0].assert_not_called()


def test_incorporation_uses_private_convivencia(http_handler):
    receipt = {
        "id_incorporacion": INCORPORATION_KEY,
        "id_arriendo": 4,
        "id_publicacion": 7,
        "id_usuario": 2,
        "estado": "Activa",
        "confirmacion_publicacion": "Pendiente",
    }
    http_handler.side_effect = None
    http_handler.return_value = httpx.Response(
        201, json=receipt, headers={"Idempotency-Replayed": "false"}
    )

    assert HttpIncorporations().incorporate(INCORPORATION, INCORPORATION_KEY) == receipt

    request, = http_handler.call_args.args
    assert request.method == "POST"
    assert str(request.url) == "http://convivencia-mensajeria:8000/internal/incorporaciones"
    assert request.headers["x-roomies-service"] == INTERNAL_TOKEN
    assert request.headers["idempotency-key"] == INCORPORATION_KEY


def test_incorporation_rejects_unapproved_destination(monkeypatch, http_handler):
    monkeypatch.setenv("CONVIVENCIA_UPSTREAM_URL", "https://convivencia.example.test")
    with pytest.raises(DependencyUnavailable):
        HttpIncorporations().incorporate(INCORPORATION, INCORPORATION_KEY)
    http_handler.assert_not_called()


def test_storage_uses_selected_project_and_publication_bucket(http_handler):
    path = f"7/{'a' * 32}/0-{'b' * 64}.jpg"
    http_handler.side_effect = None
    http_handler.return_value = httpx.Response(201)

    result = service().images.upload(path, b"synthetic-photo", "image/jpeg")

    assert result == f"{AUTH_ORIGIN}/storage/v1/object/public/publicaciones/{path}"
    request, = http_handler.call_args.args
    assert request.method == "POST"
    assert str(request.url) == f"{AUTH_ORIGIN}/storage/v1/object/publicaciones/{path}"
    assert request.headers["apikey"] == STORAGE_KEY
    assert "authorization" not in request.headers
