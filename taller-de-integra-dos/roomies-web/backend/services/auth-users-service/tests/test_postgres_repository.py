from contextlib import AbstractContextManager
from datetime import date
from pathlib import Path
from uuid import UUID

import pytest
from fastapi import HTTPException

from app.api.dependencies import get_profile_repository
from app.application.profiles import ProfileRepositoryUnavailable, initialize_my_profile
from app.domain.identity import VerifiedIdentity
from app.domain.profile import ProfileInitialization, ProfilePatch
from app.infrastructure.persistence.postgres_profile_repository import (
    PostgresProfileRepository,
)
from app.infrastructure.persistence.settings import (
    DatabaseSettingsError,
    PostgresDatabaseSettings,
)


USER_A = UUID("1786a4dd-f811-4cc0-8ed2-a4e6eb9db131")
USER_B = UUID("a6f2c044-79e0-4c79-83d8-58a2da3f4cf9")
ROW_A = (41, USER_A, "Ana", 25, "Estudiante", "Temuco", "Busca roomie", "Hola", None)


class FakeCursor(AbstractContextManager):
    def __init__(self, connection):
        self.connection = connection
        self.row = None

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        return False

    def execute(self, statement, parameters):
        self.connection.calls.append((statement, parameters))
        if self.connection.fail_execute:
            raise OSError("private query diagnostic")
        if statement.lstrip().startswith("UPDATE"):
            self.row = ROW_A
        elif "ON CONFLICT (supabase_user_id) DO NOTHING" in statement:
            self.row = self.connection.insert_row
        elif "WHERE supabase_user_id = %s" in statement:
            self.row = ROW_A
        else:
            self.row = None

    def fetchone(self):
        return self.row


class FakeConnection(AbstractContextManager):
    def __init__(self, calls, *, fail_execute=False, insert_row=None):
        self.calls = calls
        self.fail_execute = fail_execute
        self.insert_row = insert_row

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, traceback):
        self.calls.append(("COMMIT" if exc_type is None else "ROLLBACK", ()))
        return False

    def cursor(self):
        return FakeCursor(self)


def repository(*, fail=False, fail_execute=False, insert_row=None):
    calls = []

    def connector():
        if fail:
            raise OSError("private connection diagnostic")
        return FakeConnection(
            calls, fail_execute=fail_execute, insert_row=insert_row
        )

    settings = PostgresDatabaseSettings("postgresql://local/roomies_auth_users_dev")
    return PostgresProfileRepository(settings, connector=connector), calls


def test_database_settings_accepts_exact_local_dev_instance():
    settings = PostgresDatabaseSettings.from_environment(
        {
            "AUTH_USERS_DATABASE_URL": "postgresql://sql_auth_users@127.0.0.1:15432/roomies_auth_users_dev",
            "AUTH_USERS_DB_CONNECT_TIMEOUT_SECONDS": "4",
        }
    )
    assert settings.environment == "development"
    assert settings.connect_timeout_seconds == 4


@pytest.mark.parametrize(
    "url",
    [
        "",
        "postgresql://sql_auth_users@db.example:15432/roomies_auth_users_dev",
        "postgresql://sql_auth_users@127.0.0.1:5432/roomies_auth_users_dev",
        "postgresql://sql_auth_users@localhost:15432/roomies_auth_users_dev",
        "postgresql://sql_auth_users@127.0.0.1:15432/roomies",
        "postgresql://sql_auth_users@127.0.0.1:15432/roomies_auth_users_dev?host=external.example",
        "postgresql://other_user@127.0.0.1:15432/roomies_auth_users_dev",
    ],
)
def test_database_settings_reject_missing_remote_shared_or_overridden_targets(url):
    with pytest.raises(DatabaseSettingsError):
        PostgresDatabaseSettings.from_environment({"AUTH_USERS_DATABASE_URL": url})


def test_staging_settings_allow_explicit_authorized_tls_host_without_fixed_port():
    settings = PostgresDatabaseSettings.from_environment(
        {
            "AUTH_USERS_DATABASE_ENVIRONMENT": "staging",
            "AUTH_USERS_STAGING_ALLOWED_HOSTS": "pg-staging.example",
            "AUTH_USERS_DATABASE_URL": (
                "postgresql://sql_auth_users@pg-staging.example:6432/roomies_stage?sslmode=require"
            ),
        }
    )
    assert settings.environment == "staging"


@pytest.mark.parametrize(
    "environment",
    [
        {
            "AUTH_USERS_DATABASE_ENVIRONMENT": "staging",
            "AUTH_USERS_DATABASE_URL": "postgresql://sql_auth_users@pg-staging.example:6432/roomies_stage?sslmode=require",
            "AUTH_USERS_STAGING_ALLOWED_HOSTS": "",
        },
        {
            "AUTH_USERS_DATABASE_ENVIRONMENT": "staging",
            "AUTH_USERS_DATABASE_URL": "postgresql://sql_auth_users@pg-staging.example:6432/roomies_stage",
            "AUTH_USERS_STAGING_ALLOWED_HOSTS": "pg-staging.example",
        },
        {
            "AUTH_USERS_DATABASE_ENVIRONMENT": "staging",
            "AUTH_USERS_DATABASE_URL": "postgresql://sql_auth_users@pg-other.example:6432/roomies_stage?sslmode=require",
            "AUTH_USERS_STAGING_ALLOWED_HOSTS": "pg-staging.example",
        },
        {
            "AUTH_USERS_DATABASE_ENVIRONMENT": "staging",
            "AUTH_USERS_DATABASE_URL": "postgresql://sql_auth_users@pg-staging.example:0/roomies_stage?sslmode=require",
            "AUTH_USERS_STAGING_ALLOWED_HOSTS": "pg-staging.example",
        },
        {
            "AUTH_USERS_DATABASE_ENVIRONMENT": "production",
            "AUTH_USERS_DATABASE_URL": "postgresql://sql_auth_users@pg-staging.example:6432/roomies_stage?sslmode=require",
            "AUTH_USERS_STAGING_ALLOWED_HOSTS": "pg-staging.example",
        },
    ],
)
def test_staging_settings_fail_closed_without_explicit_allowed_tls_target(environment):
    with pytest.raises(DatabaseSettingsError):
        PostgresDatabaseSettings.from_environment(environment)


def test_migration_role_guard_checks_all_memberships_and_runtime_gets_minimal_grants():
    migration_directory = Path(__file__).resolve().parents[1] / "migrations"
    schema_sql = (migration_directory / "001_auth_users_schema.up.sql").read_text()
    grants_sql = (migration_directory / "002_auth_users_runtime_grants.up.sql").read_text()

    assert "m.member = r.oid OR m.roleid = r.oid" in schema_sql
    assert "NOT r.rolsuper" in schema_sql
    assert "NOT r.rolcreatedb" in schema_sql
    assert "NOT r.rolcreaterole" in schema_sql
    assert "NOT r.rolreplication" in schema_sql
    assert "NOT r.rolbypassrls" in schema_sql
    assert "GRANT SELECT ON TABLE auth_users.usuario" in grants_sql
    assert "GRANT INSERT (supabase_user_id, nombre, fecha_nacimiento)" in grants_sql
    assert "GRANT UPDATE (edad, ocupacion, ciudad, breve_descripcion, sobre_mi)" in grants_sql
    assert "GRANT USAGE ON SEQUENCE auth_users.usuario_id_usuario_seq" in grants_sql
    assert "GRANT USAGE, SELECT ON SEQUENCE" not in grants_sql
    assert "GRANT SELECT, INSERT, UPDATE ON TABLE" not in grants_sql


def test_migration_files_delegate_atomicity_to_single_transaction_runner():
    migration_directory = Path(__file__).resolve().parents[1] / "migrations"
    migration_files = tuple(migration_directory.glob("*.sql"))
    documentation = (migration_directory.parent / "DATABASE.md").read_text()

    assert len(migration_files) == 4
    for migration_file in migration_files:
        top_level = {
            line.strip().upper()
            for line in migration_file.read_text().splitlines()
            if line.strip()
        }
        assert "BEGIN;" not in top_level
        assert "COMMIT;" not in top_level
    assert "--single-transaction" in documentation
    assert "ON_ERROR_STOP=1" in documentation


def test_production_dependency_fails_closed_without_service_specific_database_setting(monkeypatch):
    monkeypatch.delenv("AUTH_USERS_DATABASE_URL", raising=False)
    monkeypatch.setenv("DATABASE_URL", "must-not-be-used")

    with pytest.raises(HTTPException) as error:
        get_profile_repository()

    assert error.value.status_code == 503


def test_get_uses_bound_supabase_uuid_and_maps_without_integer_cast():
    repo, calls = repository()

    assert repo.get_by_supabase_user_id(USER_A).id_usuario == 41
    statement, parameters = calls[0]
    assert "WHERE supabase_user_id = %s" in statement
    assert parameters == (USER_A,)
    assert calls[-1][0] == "COMMIT"


def test_patch_binds_values_and_uses_only_allowlisted_column_names():
    repo, calls = repository()
    patch = ProfilePatch(
        fields_set=frozenset({"ciudad", "sobre_mi"}),
        ciudad="Temuco",
        sobre_mi="texto'; DROP TABLE auth_users.usuario; --",
    )

    result = repo.patch_by_supabase_user_id(USER_A, patch)

    statement, parameters = calls[0]
    assert "ciudad = %s" in statement and "sobre_mi = %s" in statement
    assert "DROP TABLE" not in statement
    assert parameters == ("Temuco", patch.sobre_mi, USER_A)
    assert result.supabase_user_id == USER_A


def test_ensure_profile_uses_conflict_safe_insert_then_reads_existing_row():
    repo, calls = repository()
    result = repo.ensure_profile(USER_A, nombre="Ana", fecha_nacimiento=date(2000, 3, 5))

    insert_sql, insert_params = calls[0]
    assert "ON CONFLICT (supabase_user_id) DO NOTHING" in insert_sql
    assert insert_params == (USER_A, "Ana", date(2000, 3, 5))
    assert "WHERE supabase_user_id = %s" in calls[1][0]
    assert calls[1][1] == (USER_A,)
    assert result.id_usuario == 41
    assert result.supabase_user_id == USER_A


def test_ensure_profile_returns_inserted_row_without_second_lookup():
    repo, calls = repository(insert_row=ROW_A)

    result = repo.ensure_profile(USER_A, nombre="Ana", fecha_nacimiento=date(2000, 3, 5))

    assert result.id_usuario == 41
    assert len(calls) == 2  # Insert execution plus successful transaction close.
    assert "ON CONFLICT (supabase_user_id) DO NOTHING" in calls[0][0]


def test_database_failure_is_translated_without_driver_details():
    repo, _ = repository(fail=True)

    with pytest.raises(ProfileRepositoryUnavailable) as error:
        repo.get_by_supabase_user_id(USER_A)

    assert "private connection diagnostic" not in str(error.value)


def test_query_failure_rolls_back_transaction_and_hides_diagnostics():
    repo, calls = repository(fail_execute=True)

    with pytest.raises(ProfileRepositoryUnavailable) as error:
        repo.patch_by_supabase_user_id(
            USER_A,
            ProfilePatch(fields_set=frozenset({"ciudad"}), ciudad="Temuco"),
        )

    assert calls[-1][0] == "ROLLBACK"
    assert "private query diagnostic" not in str(error.value)


def test_initial_profile_validates_name_and_legacy_adult_age_rule():
    with pytest.raises(ValueError):
        ProfileInitialization("  ", date(2000, 1, 1))
    with pytest.raises(ValueError):
        ProfileInitialization("Ana", date.today())


def test_initial_profile_use_case_uses_identity_uuid_and_returns_created_profile():
    class Repository:
        def ensure_profile(self, user_id, *, nombre, fecha_nacimiento):
            assert user_id == USER_A
            assert nombre == "Ana"
            assert fecha_nacimiento == date(2000, 3, 5)
            from app.domain.profile import RoomiesProfile

            return RoomiesProfile(
                id_usuario=41,
                supabase_user_id=user_id,
                nombre=nombre,
                edad=None,
                ocupacion=None,
                ciudad="Temuco",
                breve_descripcion=None,
                sobre_mi=None,
                foto_perfil=None,
                verificado=None,
            )

    result = initialize_my_profile(
        VerifiedIdentity(USER_A),
        ProfileInitialization(" Ana ", date(2000, 3, 5)),
        Repository(),
    )
    assert result.id_usuario == 41
    assert result.supabase_user_id == USER_A
