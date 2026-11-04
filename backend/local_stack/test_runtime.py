"""Configuración real preparada; estas pruebas NO abren conexiones remotas."""
import pytest
from backend.service_runtime.settings import database_url, auth_provider_url, runtime_mode
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
