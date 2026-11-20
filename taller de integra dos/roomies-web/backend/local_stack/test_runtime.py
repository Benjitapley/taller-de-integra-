"""Configuración real preparada; estas pruebas NO abren conexiones remotas."""
from pathlib import Path
from urllib.parse import quote, urlencode

import pytest
from backend.service_runtime.settings import database_url, auth_provider_url, runtime_mode, service_url
from backend.service_runtime.contracts import DependencyUnavailable

REF = "a" * 20
HOST = f"db.{REF}.supabase.co"
DSN = f"postgresql://sql_auth_users:fictional@{HOST}:5432/postgres?sslmode=verify-full&sslrootcert=system"

@pytest.fixture
def real(monkeypatch):
    monkeypatch.setenv("ROOMIES_RUNTIME_MODE", "supabase")
    monkeypatch.delenv("ROOMIES_LOCAL_MODE", raising=False)
    monkeypatch.setenv("ROOMIES_SUPABASE_PROJECT_REF", REF)
    monkeypatch.setenv("ROOMIES_SUPABASE_DB_HOST", HOST)
    monkeypatch.setenv("ROOMIES_AUTH_PROVIDER_URL", f"https://{REF}.supabase.co")
    monkeypatch.setenv("AUTH_USERS_DATABASE_URL", DSN)

def test_real_explicit_project_role_and_tls(real):
    assert runtime_mode() == "supabase"
    assert database_url("AUTH_USERS_DATABASE_URL", "sql_auth_users") == DSN
    assert auth_provider_url() == f"https://{REF}.supabase.co"

@pytest.mark.parametrize("dsn", [DSN.replace("verify-full", "require"), DSN.replace("sql_auth_users:", "postgres:"), DSN.replace("/postgres?", "/wrong?"), DSN.replace(HOST, "other.supabase.co"), DSN + "&sslmode=disable", DSN.replace("&sslrootcert=system", "")])
def test_rejects_wrong_target_role_or_tls(real, monkeypatch, dsn):
    monkeypatch.setenv("AUTH_USERS_DATABASE_URL", dsn)
    with pytest.raises(DependencyUnavailable): database_url("AUTH_USERS_DATABASE_URL", "sql_auth_users")

def test_pooler_requires_role_and_project(real, monkeypatch):
    host = "aws-1-sa-east-1.pooler.supabase.com"
    monkeypatch.setenv("ROOMIES_SUPABASE_DB_HOST", host)
    dsn = DSN.replace(HOST, host).replace("sql_auth_users:", f"sql_auth_users.{REF}:").replace(":5432/", ":6543/")
    monkeypatch.setenv("AUTH_USERS_DATABASE_URL", dsn)
    assert database_url("AUTH_USERS_DATABASE_URL", "sql_auth_users") == dsn
    monkeypatch.setenv("AUTH_USERS_DATABASE_URL", dsn.replace("sql_auth_users." + REF, "sql_auth_users." + "b" * 20))
    with pytest.raises(DependencyUnavailable): database_url("AUTH_USERS_DATABASE_URL", "sql_auth_users")

def test_no_simultaneous_targets_or_other_auth(real, monkeypatch):
    monkeypatch.setenv("ROOMIES_AUTH_PROVIDER_URL", "https://other.supabase.co")
    with pytest.raises(DependencyUnavailable): auth_provider_url()
    monkeypatch.setenv("ROOMIES_LOCAL_MODE", "1")
    with pytest.raises(DependencyUnavailable): runtime_mode()

def test_dpapi_recovers_fixture_bytes():
    from backend.local_stack.backup_restore import dpapi
    source = b"fictional backup test; no remote records"
    protected = dpapi(source)
    assert source not in protected
    assert dpapi(protected, decrypt=True) == source


KUBERO_HOST = "db-test.roomies.internal"
KUBERO_TARGET = f"{KUBERO_HOST}:5432/roomies_test"
# Archivo existente para comprobar la ruta sin crear archivos ni cargar certificados.
KUBERO_CA_PATH = Path(__file__).resolve()
KUBERO_CA = str(KUBERO_CA_PATH)
KUBERO_DSN = f"postgresql://sql_auth_users:fixture%40only@{KUBERO_TARGET}?" + urlencode(
    {"sslmode": "verify-full", "sslrootcert": KUBERO_CA, "gssencmode": "disable"},
    quote_via=quote,
)


@pytest.fixture
def kubero(real, monkeypatch):
    for name, value in {
        "ROOMIES_RUNTIME_MODE": "kubero",
        "ROOMIES_KUBERO_DB_HOST": KUBERO_HOST,
        "ROOMIES_KUBERO_DB_PORT": "5432",
        "ROOMIES_KUBERO_DB_NAME": "roomies_test",
        "ROOMIES_KUBERO_DB_SSLROOTCERT": KUBERO_CA,
        "AUTH_USERS_DATABASE_URL": KUBERO_DSN,
    }.items():
        monkeypatch.setenv(name, value)
    for name in ("PGHOSTADDR", "PGSERVICE", "ROOMIES_JWT_ISSUER"):
        monkeypatch.delenv(name, raising=False)


@pytest.mark.parametrize("host", [
    KUBERO_HOST,
    "roomies-db.roomies-test.svc.cluster.local",
    "roomies-db",
])
def test_kubero_accepts_only_configured_target_with_supabase_auth(kubero, monkeypatch, host):
    from psycopg.conninfo import conninfo_to_dict

    configured_dsn = KUBERO_DSN.replace(KUBERO_HOST, host)
    monkeypatch.setenv("ROOMIES_KUBERO_DB_HOST", host)
    monkeypatch.setenv("AUTH_USERS_DATABASE_URL", configured_dsn)
    assert runtime_mode() == "kubero"
    dsn = database_url("AUTH_USERS_DATABASE_URL", "sql_auth_users")
    assert dsn == configured_dsn
    assert conninfo_to_dict(dsn) == {
        "host": host, "port": "5432", "dbname": "roomies_test",
        "user": "sql_auth_users", "password": "fixture@only",
        "sslmode": "verify-full", "sslrootcert": KUBERO_CA, "gssencmode": "disable",
    }
    assert auth_provider_url() == f"https://{REF}.supabase.co"


@pytest.mark.parametrize(("old", "new"), [
    (KUBERO_HOST, "other.internal"),
    (KUBERO_HOST, f"{KUBERO_HOST},other.internal"),
    (":5432/", ":6543/"),
    ("/roomies_test?", "/postgres?"),
    ("sql_auth_users:", "postgres:"),
    ("fixture%40only", ""),
    ("fixture%40only", "fixture%00only"),
    ("verify-full", "require"),
    (KUBERO_CA_PATH.name, "other-ca.pem"),
    ("gssencmode=disable", "gssencmode=prefer"),
    ("gssencmode=disable", "sslmode=disable"),
    ("gssencmode=disable", "gssencmode=disable&hostaddr=127.0.0.1"),
    ("&gssencmode=disable", ""),
    ("gssencmode=disable", "gssencmode=disable#"),
])
def test_kubero_rejects_invalid_dsn(kubero, monkeypatch, old, new):
    monkeypatch.setenv("AUTH_USERS_DATABASE_URL", KUBERO_DSN.replace(old, new))
    with pytest.raises(DependencyUnavailable):
        database_url("AUTH_USERS_DATABASE_URL", "sql_auth_users")


@pytest.mark.parametrize("name", [
    "ROOMIES_KUBERO_DB_HOST", "ROOMIES_KUBERO_DB_PORT", "ROOMIES_KUBERO_DB_NAME",
    "ROOMIES_KUBERO_DB_SSLROOTCERT", "AUTH_USERS_DATABASE_URL", "ROOMIES_SUPABASE_PROJECT_REF",
])
def test_kubero_rejects_missing_configuration(kubero, monkeypatch, name):
    monkeypatch.delenv(name)
    with pytest.raises(DependencyUnavailable):
        database_url("AUTH_USERS_DATABASE_URL", "sql_auth_users")


@pytest.mark.parametrize(("name", "old", "new"), [
    ("ROOMIES_KUBERO_DB_HOST", KUBERO_HOST, "server-postgres"),
    ("ROOMIES_KUBERO_DB_HOST", KUBERO_HOST, "127.0.0.1"),
    ("ROOMIES_KUBERO_DB_PORT", "5432", "65536"),
    ("ROOMIES_KUBERO_DB_NAME", "roomies_test", "roomies/test"),
    ("ROOMIES_KUBERO_DB_SSLROOTCERT", KUBERO_CA, "relative-ca.pem"),
    ("ROOMIES_KUBERO_DB_SSLROOTCERT", KUBERO_CA, KUBERO_CA + ".missing.pem"),
])
def test_kubero_rejects_invalid_target_even_if_dsn_matches(kubero, monkeypatch, name, old, new):
    monkeypatch.setenv(name, new)
    if name == "ROOMIES_KUBERO_DB_SSLROOTCERT":
        old, new = quote(old, safe=""), quote(new, safe="")
    monkeypatch.setenv("AUTH_USERS_DATABASE_URL", KUBERO_DSN.replace(old, new))
    with pytest.raises(DependencyUnavailable):
        database_url("AUTH_USERS_DATABASE_URL", "sql_auth_users")


@pytest.mark.parametrize("name", ["PGHOSTADDR", "PGSERVICE"])
def test_kubero_rejects_libpq_destination_overrides(kubero, monkeypatch, name):
    monkeypatch.setenv(name, "override")
    with pytest.raises(DependencyUnavailable):
        database_url("AUTH_USERS_DATABASE_URL", "sql_auth_users")


@pytest.mark.parametrize(("name", "value"), [
    ("ROOMIES_AUTH_PROVIDER_URL", "https://other.supabase.co"),
    ("ROOMIES_JWT_ISSUER", "https://other.supabase.co/auth/v1"),
    ("ROOMIES_LOCAL_MODE", "1"),
])
def test_kubero_rejects_other_identity_or_local_mode(kubero, monkeypatch, name, value):
    monkeypatch.setenv(name, value)
    with pytest.raises(DependencyUnavailable):
        auth_provider_url()


def test_disposable_keeps_its_local_destination(kubero, monkeypatch):
    monkeypatch.setenv("ROOMIES_RUNTIME_MODE", "disposable")
    monkeypatch.setenv("ROOMIES_LOCAL_MODE", "1")
    with pytest.raises(DependencyUnavailable):
        database_url("AUTH_USERS_DATABASE_URL", "sql_auth_users")
    local_dsn = "postgresql://sql_auth_users:fictional@roomies-db:5432/roomies_sprint2_disposable"
    monkeypatch.setenv("AUTH_USERS_DATABASE_URL", local_dsn)
    assert database_url("AUTH_USERS_DATABASE_URL", "sql_auth_users") == local_dsn


@pytest.mark.parametrize("variable", [
    "AUTH_USERS_UPSTREAM_URL", "LISTADO_UPSTREAM_URL", "MATCH_UPSTREAM_URL",
])
@pytest.mark.parametrize("origin", [
    "https://roomies-auth.example.com",
    "https://roomies-listado.onrender.com/",
    "https://roomies-match.onrender.com:443",
])
def test_shared_services_use_configured_https_origins(real, monkeypatch, variable, origin):
    monkeypatch.setenv(variable, origin)
    assert service_url(variable) == origin.rstrip("/")


@pytest.mark.parametrize("origin", [
    "", "http://roomies-auth.onrender.com:8000",
    "https://user:password@roomies-auth.onrender.com",
    "https://@roomies-auth.onrender.com",
    "https://roomies-auth.onrender.com/api",
    "https://roomies-auth.onrender.com?query=1",
    "https://roomies-auth.onrender.com?",
    "https://roomies-auth.onrender.com#fragment",
    "https://roomies-auth.onrender.com#",
    "https://roomies-auth.onrender.com:0",
    "https://roomies-auth.onrender.com:65536",
    "https://roomies-auth.onrender.com:",
    "https://roomies-auth.onrender.com:invalid",
    "https://roomies-auth.onrender.com\\@evil.example",
    " https://roomies-auth.onrender.com",
    "https://roomies-auth.onrender.com\n",
    "https://roomies-auth.onrender.com\t",
    "https://roomies-auth.onrender.com\x7f",
    "https://roomies-auth.onrender.com/%2f",
    "https://roomies_auth.onrender.com",
    "https://-roomies.onrender.com",
    "https://roomies..onrender.com",
    "https://127.0.0.1",
    "https://169.254.169.254",
    "https://[::1]",
    "//roomies-auth.onrender.com",
    "file:///etc/passwd",
])
def test_shared_services_reject_invalid_origins(real, monkeypatch, origin):
    monkeypatch.setenv("AUTH_USERS_UPSTREAM_URL", origin)
    with pytest.raises(DependencyUnavailable):
        service_url("AUTH_USERS_UPSTREAM_URL")


def test_request_values_cannot_select_a_remote_service(real, monkeypatch):
    monkeypatch.setenv("REQUEST_URL", "https://untrusted.example.com")
    with pytest.raises(DependencyUnavailable):
        service_url("REQUEST_URL")
    monkeypatch.delenv("AUTH_USERS_UPSTREAM_URL", raising=False)
    with pytest.raises(DependencyUnavailable):
        service_url("AUTH_USERS_UPSTREAM_URL")


@pytest.mark.parametrize("mode", ["disposable", "supabase"])
@pytest.mark.parametrize("origin", [
    "http://127.0.0.1:8010", "http://localhost:8010/",
    "http://auth-users:8000", "http://listado-applications:8000",
])
def test_existing_local_destinations_remain_supported(real, monkeypatch, mode, origin):
    monkeypatch.setenv("ROOMIES_RUNTIME_MODE", mode)
    if mode == "disposable":
        monkeypatch.setenv("ROOMIES_LOCAL_MODE", "1")
    monkeypatch.setenv("AUTH_USERS_UPSTREAM_URL", origin)
    assert service_url("AUTH_USERS_UPSTREAM_URL", docker_hosts=("auth-users", "listado-applications")) == origin.rstrip("/")


def test_disposable_mode_keeps_remote_services_disabled(real, monkeypatch):
    monkeypatch.setenv("ROOMIES_RUNTIME_MODE", "disposable")
    monkeypatch.setenv("ROOMIES_LOCAL_MODE", "1")
    monkeypatch.setenv("AUTH_USERS_UPSTREAM_URL", "https://roomies-auth.onrender.com")
    with pytest.raises(DependencyUnavailable):
        service_url("AUTH_USERS_UPSTREAM_URL")
