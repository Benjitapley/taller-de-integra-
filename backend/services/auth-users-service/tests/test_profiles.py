from uuid import UUID

import pytest
from pydantic import ValidationError

from app.application.profiles import (
    ProfileNotFound,
    ProfileOwnershipViolation,
    get_my_profile,
    patch_my_profile,
)
from app.domain.identity import VerifiedIdentity
from app.domain.profile import ProfilePatch, RoomiesProfile
from app.schemas.profile import ProfilePatchRequest


USER_A = UUID("1786a4dd-f811-4cc0-8ed2-a4e6eb9db131")
USER_B = UUID("a6f2c044-79e0-4c79-83d8-58a2da3f4cf9")


def profile(user_id=USER_A, roomies_id=17):
    return RoomiesProfile(
        id_usuario=roomies_id,
        supabase_user_id=user_id,
        nombre="Roomie",
        edad=25,
        ocupacion="Estudiante",
        ciudad="Temuco",
        breve_descripcion="Hola",
        sobre_mi="Acerca de mí",
        foto_perfil=None,
        verificado=False,
    )


def patch(**overrides):
    values = {"ciudad": "Temuco"}
    values.update(overrides)
    return ProfilePatch(fields_set=frozenset(values), **values)


class FakeProfileRepository:
    """Test-only repository double; not a persistence implementation."""

    def __init__(self, stored_profile=None, return_unmatched=False):
        self.stored_profile = stored_profile
        self.return_unmatched = return_unmatched
        self.lookup_ids = []
        self.patch_calls = []

    def _matches(self, user_id):
        return (
            self.stored_profile is not None
            and self.stored_profile.supabase_user_id == user_id
        )

    def get_by_supabase_user_id(self, user_id):
        self.lookup_ids.append(user_id)
        if self._matches(user_id) or self.return_unmatched:
            return self.stored_profile
        return None

    def patch_by_supabase_user_id(self, user_id, requested_patch):
        self.patch_calls.append((user_id, requested_patch))
        if self.stored_profile is None:
            return None
        if not self._matches(user_id):
            return self.stored_profile if self.return_unmatched else None

        current = self.stored_profile
        values = requested_patch.changes()
        updated = RoomiesProfile(
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
        self.stored_profile = updated
        return updated


def test_profile_keeps_supabase_uuid_separate_from_integer_roomies_id():
    value = profile()
    assert value.supabase_user_id == USER_A
    assert value.id_usuario == 17
    assert not isinstance(value.supabase_user_id, int)


@pytest.mark.parametrize("bad_id", [0, -1, True, USER_A])
def test_profile_rejects_invalid_roomies_integer_identifier(bad_id):
    with pytest.raises(ValueError):
        profile(roomies_id=bad_id)


@pytest.mark.parametrize(
    "payload",
    [
        {"edad": True},
        {"edad": 121},
        {"edad": "25"},
        {"ocupacion": "x" * 101},
        {"ciudad": "x\x00y"},
        {"breve_descripcion": "x" * 256},
        {"sobre_mi": "x" * 5001},
    ],
)
def test_patch_schema_rejects_invalid_values(payload):
    with pytest.raises(ValidationError):
        ProfilePatchRequest.model_validate(payload)


@pytest.mark.parametrize(
    "protected_field",
    ["id_usuario", "supabase_user_id", "nombre", "verificado", "rol", "total_publicaciones"],
)
def test_patch_schema_forbids_owner_and_protected_fields(protected_field):
    with pytest.raises(ValidationError):
        ProfilePatchRequest.model_validate({protected_field: "attacker-controlled"})


def test_patch_distinguishes_omitted_from_explicit_null():
    omitted = ProfilePatchRequest.model_validate({"ciudad": "Temuco"}).to_patch()
    explicit_null = ProfilePatchRequest.model_validate(
        {"edad": None, "ciudad": None}
    ).to_patch()

    assert omitted.fields_set == frozenset({"ciudad"})
    assert omitted.changes() == {"ciudad": "Temuco"}
    assert explicit_null.fields_set == frozenset({"edad", "ciudad"})
    assert explicit_null.changes() == {"edad": None, "ciudad": None}


def test_patch_does_not_hardcode_temuco_as_the_only_city():
    assert ProfilePatchRequest.model_validate({"ciudad": "Lautaro"}).ciudad == "Lautaro"


def test_empty_patch_is_rejected():
    with pytest.raises(ValidationError):
        ProfilePatchRequest.model_validate({})


def test_get_my_profile_queries_by_verified_supabase_uuid():
    repository = FakeProfileRepository(profile(roomies_id=804))

    result = get_my_profile(VerifiedIdentity(USER_A), repository)

    assert result.id_usuario == 804
    assert repository.lookup_ids == [USER_A]


def test_get_my_profile_reports_missing_profile():
    with pytest.raises(ProfileNotFound):
        get_my_profile(VerifiedIdentity(USER_A), FakeProfileRepository())


def test_get_my_profile_rejects_repository_result_owned_by_another_uuid():
    repository = FakeProfileRepository(profile(user_id=USER_B), return_unmatched=True)

    with pytest.raises(ProfileOwnershipViolation):
        get_my_profile(VerifiedIdentity(USER_A), repository)


def test_patch_my_profile_updates_only_supplied_fields_and_uses_uuid():
    before = profile(roomies_id=804)
    repository = FakeProfileRepository(before)
    requested = patch(ocupacion="Profesional")

    result = patch_my_profile(VerifiedIdentity(USER_A), requested, repository)

    assert repository.patch_calls == [(USER_A, requested)]
    assert result.id_usuario == before.id_usuario
    assert result.supabase_user_id == before.supabase_user_id
    assert result.nombre == before.nombre
    assert result.foto_perfil == before.foto_perfil
    assert result.verificado == before.verificado
    assert result.ciudad == before.ciudad
    assert result.ocupacion == "Profesional"


def test_patch_my_profile_clears_only_fields_explicitly_set_to_null():
    repository = FakeProfileRepository(profile())

    result = patch_my_profile(
        VerifiedIdentity(USER_A),
        ProfilePatch(fields_set=frozenset({"edad", "ciudad"}), edad=None, ciudad=None),
        repository,
    )

    assert result.edad is None
    assert result.ciudad is None
    assert result.ocupacion == "Estudiante"


def test_patch_my_profile_rejects_mismatched_repository_owner():
    repository = FakeProfileRepository(profile(user_id=USER_B), return_unmatched=True)

    with pytest.raises(ProfileOwnershipViolation):
        patch_my_profile(VerifiedIdentity(USER_A), patch(), repository)


def test_patch_my_profile_reports_missing_profile():
    with pytest.raises(ProfileNotFound):
        patch_my_profile(VerifiedIdentity(USER_A), patch(), FakeProfileRepository())
