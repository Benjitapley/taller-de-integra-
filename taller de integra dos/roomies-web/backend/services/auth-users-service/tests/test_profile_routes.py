from uuid import UUID

import pytest
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.dependencies import get_current_identity, get_jwt_verifier, get_profile_repository
from app.api.profile_api import register_profile_routes
from app.application.profiles import ProfileRepositoryUnavailable
from app.domain.identity import VerifiedIdentity
from app.domain.profile import RoomiesProfile
from app.infrastructure.security.supabase_jwt import InvalidAccessToken
from app.main import app as production_app


USER_A = UUID("1786a4dd-f811-4cc0-8ed2-a4e6eb9db131")
USER_B = UUID("a6f2c044-79e0-4c79-83d8-58a2da3f4cf9")


def sample_profile(user_id=USER_A):
    return RoomiesProfile(
        id_usuario=17,
        supabase_user_id=user_id,
        nombre="Ana Roomie",
        edad=25,
        ocupacion="Estudiante",
        ciudad="Temuco",
        breve_descripcion="Busco compartir departamento en Temuco.",
        sobre_mi="Me gusta cocinar.",
        foto_perfil=None,
        verificado=False,
    )


class FakeProfileRepository:
    """Test-only dependency override. No production persistence is provided."""

    def __init__(self, stored=None, return_unmatched=False, failure=None):
        self.stored = stored
        self.return_unmatched = return_unmatched
        self.failure = failure
        self.lookups = []
        self.patches = []

    def _check_failure(self):
        if self.failure:
            raise self.failure

    def get_by_supabase_user_id(self, user_id):
        self._check_failure()
        self.lookups.append(user_id)
        if self.stored is None:
            return None
        if self.stored.supabase_user_id == user_id or self.return_unmatched:
            return self.stored
        return None

    def patch_by_supabase_user_id(self, user_id, patch):
        self._check_failure()
        self.patches.append((user_id, patch.changes()))
        if self.stored is None:
            return None
        if self.stored.supabase_user_id != user_id:
            return self.stored if self.return_unmatched else None

        current = self.stored
        values = patch.changes()
        self.stored = RoomiesProfile(
            id_usuario=current.id_usuario,
            supabase_user_id=current.supabase_user_id,
            nombre=current.nombre,
            edad=values.get("edad", current.edad),
            ocupacion=values.get("ocupacion", current.ocupacion),
            ciudad=values.get("ciudad", current.ciudad),
            breve_descripcion=values.get("breve_descripcion", current.breve_descripcion),
            sobre_mi=values.get("sobre_mi", current.sobre_mi),
            foto_perfil=current.foto_perfil,
            verificado=current.verificado,
        )
        return self.stored


class LocalTokenVerifier:
    """Token verifier double for HTTP authorization tests; no JWKS access."""

    def verify(self, token):
        if token == "test-valid-token":
            return VerifiedIdentity(USER_A)
        raise InvalidAccessToken()


def make_test_client(repository, *, override_identity=False, override_repository=True):
    test_app = FastAPI()
    register_profile_routes(test_app)
    if override_repository:
        if repository is None:
            raise ValueError("Inyecta un repositorio de prueba explícitamente.")
        test_app.dependency_overrides[get_profile_repository] = lambda: repository
    if override_identity:
        test_app.dependency_overrides[get_current_identity] = lambda: VerifiedIdentity(USER_A)
    else:
        test_app.dependency_overrides[get_jwt_verifier] = LocalTokenVerifier
    return TestClient(test_app)


@pytest.fixture
def repository():
    return FakeProfileRepository(sample_profile())


def test_production_app_registers_profile_routes_backed_by_real_dependency():
    paths = production_app.openapi()["paths"]
    assert "/usuarios/me" in paths
    assert set(paths["/usuarios/me"]) == {"get", "patch"}
    assert "/health" in production_app.openapi()["paths"]


def test_get_my_profile_returns_only_profile_fields_with_no_store(repository):
    with make_test_client(repository) as client:
        response = client.get(
            "/usuarios/me", headers={"Authorization": "Bearer test-valid-token"}
        )

    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert response.json() == {
        "nombre": "Ana Roomie",
        "edad": 25,
        "ocupacion": "Estudiante",
        "ciudad": "Temuco",
        "breve_descripcion": "Busco compartir departamento en Temuco.",
        "sobre_mi": "Me gusta cocinar.",
        "foto_perfil": None,
    }
    assert repository.lookups == [USER_A]
    assert "id_usuario" not in response.json()
    assert "supabase_user_id" not in response.json()
    assert "total_publicaciones" not in response.json()
    assert "verificado" not in response.json()


def test_get_my_profile_returns_404_when_identity_has_no_profile():
    with make_test_client(FakeProfileRepository()) as client:
        response = client.get(
            "/usuarios/me", headers={"Authorization": "Bearer test-valid-token"}
        )

    assert response.status_code == 404
    assert response.headers["cache-control"] == "no-store"


def test_patch_changes_only_fields_present_in_json(repository):
    with make_test_client(repository) as client:
        response = client.patch(
            "/usuarios/me",
            headers={"Authorization": "Bearer test-valid-token"},
            json={"ocupacion": "Profesional"},
        )

    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
    assert response.json()["ocupacion"] == "Profesional"
    assert response.json()["ciudad"] == "Temuco"
    assert response.json()["edad"] == 25
    assert repository.patches == [(USER_A, {"ocupacion": "Profesional"})]


def test_patch_null_clears_only_explicitly_null_fields(repository):
    with make_test_client(repository) as client:
        response = client.patch(
            "/usuarios/me",
            headers={"Authorization": "Bearer test-valid-token"},
            json={"edad": None, "ciudad": None},
        )

    assert response.status_code == 200
    assert response.json()["edad"] is None
    assert response.json()["ciudad"] is None
    assert response.json()["ocupacion"] == "Estudiante"
    assert repository.patches == [(USER_A, {"edad": None, "ciudad": None})]


@pytest.mark.parametrize(
    "payload",
    [
        {},
        {"edad": True},
        {"edad": 121},
        {"ciudad": "x\x00y"},
        {"sobre_mi": "x" * 5001},
        {"nombre": "No editable"},
        {"id_usuario": 99},
        {"supabase_user_id": str(USER_B)},
        {"verificado": True},
        {"total_publicaciones": 900},
    ],
)
def test_patch_rejects_invalid_or_protected_input_without_echoing_values(repository, payload):
    marker = "private-input-marker"
    payload = dict(payload)
    if "id_usuario" in payload:
        payload["id_usuario"] = marker
    if "nombre" in payload:
        payload["nombre"] = marker

    with make_test_client(repository) as client:
        response = client.patch(
            "/usuarios/me",
            headers={"Authorization": "Bearer test-valid-token"},
            json=payload,
        )

    assert response.status_code == 422
    assert response.headers["cache-control"] == "no-store"
    assert marker not in response.text
    assert "input" not in response.json()["detail"][0]
    assert repository.patches == []


def test_missing_bearer_is_401_and_no_store(repository):
    with make_test_client(repository) as client:
        response = client.get("/usuarios/me")

    assert response.status_code == 401
    assert response.headers["cache-control"] == "no-store"
    assert response.headers["www-authenticate"] == "Bearer"


def test_invalid_bearer_is_401_and_no_store(repository):
    with make_test_client(repository) as client:
        response = client.get(
            "/usuarios/me", headers={"Authorization": "Bearer invalid-token"}
        )

    assert response.status_code == 401
    assert response.headers["cache-control"] == "no-store"


def test_profile_repository_fails_closed_without_database_configuration(monkeypatch):
    monkeypatch.delenv("AUTH_USERS_DATABASE_URL", raising=False)
    monkeypatch.delenv("AUTH_USERS_DATABASE_ENVIRONMENT", raising=False)
    monkeypatch.setenv("DATABASE_URL", "must-not-be-used")

    with make_test_client(
        None,
        override_identity=True,
        override_repository=False,
    ) as client:
        response = client.get("/usuarios/me")

    assert response.status_code == 503
    assert response.headers["cache-control"] == "no-store"
    assert "no está configurada" in response.json()["detail"]


@pytest.mark.parametrize("method", ["get", "patch"])
def test_repository_unavailable_returns_sanitized_503(method):
    repository = FakeProfileRepository(
        sample_profile(), failure=ProfileRepositoryUnavailable("private database detail")
    )
    with make_test_client(repository) as client:
        if method == "get":
            response = client.get("/usuarios/me", headers={"Authorization": "Bearer test-valid-token"})
        else:
            response = client.patch(
                "/usuarios/me",
                headers={"Authorization": "Bearer test-valid-token"},
                json={"ciudad": "Temuco"},
            )

    assert response.status_code == 503
    assert response.headers["cache-control"] == "no-store"
    assert "private database detail" not in response.text


def test_repository_returning_another_users_profile_is_hidden_as_404():
    repository = FakeProfileRepository(sample_profile(USER_B), return_unmatched=True)
    with make_test_client(repository) as client:
        response = client.get(
            "/usuarios/me", headers={"Authorization": "Bearer test-valid-token"}
        )

    assert response.status_code == 404
    assert response.headers["cache-control"] == "no-store"
    assert "Ana Roomie" not in response.text


def test_unexpected_profile_error_returns_generic_500_without_store_or_detail():
    repository = FakeProfileRepository(
        sample_profile(), failure=RuntimeError("private implementation detail")
    )
    with make_test_client(repository) as client:
        response = client.get(
            "/usuarios/me", headers={"Authorization": "Bearer test-valid-token"}
        )

    assert response.status_code == 500
    assert response.headers["cache-control"] == "no-store"
    assert response.json() == {"detail": "Error interno."}
    assert "private implementation detail" not in response.text
