"""Profile use cases independent of FastAPI and database infrastructure."""

from app.domain.identity import VerifiedIdentity
from app.domain.profile import ProfileInitialization, ProfilePatch, RoomiesProfile
from app.application.profile_repository import ProfileRepository


class ProfileNotFound(Exception):
    """The verified identity has no Roomies profile yet."""


class ProfileOwnershipViolation(Exception):
    """A repository returned a profile linked to a different identity."""


class ProfileRepositoryUnavailable(Exception):
    """The profile persistence dependency is unavailable."""


def _assert_owner(profile: RoomiesProfile, identity: VerifiedIdentity) -> None:
    if profile.supabase_user_id != identity.supabase_user_id:
        raise ProfileOwnershipViolation("El perfil no pertenece a la identidad autenticada.")


def get_my_profile(
    identity: VerifiedIdentity, repository: ProfileRepository
) -> RoomiesProfile:
    """Load only the profile linked to the verified token subject."""

    profile = repository.get_by_supabase_user_id(identity.supabase_user_id)
    if profile is None:
        raise ProfileNotFound()
    _assert_owner(profile, identity)
    return profile


def patch_my_profile(
    identity: VerifiedIdentity,
    patch: ProfilePatch,
    repository: ProfileRepository,
) -> RoomiesProfile:
    """Patch only supplied fields on the profile linked to the token subject."""

    profile = repository.patch_by_supabase_user_id(
        identity.supabase_user_id, patch
    )
    if profile is None:
        raise ProfileNotFound()
    _assert_owner(profile, identity)
    return profile


def initialize_my_profile(
    identity: VerifiedIdentity,
    initial_profile: ProfileInitialization,
    repository: ProfileRepository,
) -> RoomiesProfile:
    """Idempotently ensure a profile for a verified identity.

    The caller must first enforce the approved Supabase email-confirmation
    policy. This use case is deliberately not exposed as an HTTP route yet.
    """

    profile = repository.ensure_profile(
        identity.supabase_user_id,
        nombre=initial_profile.nombre,
        fecha_nacimiento=initial_profile.fecha_nacimiento,
    )
    _assert_owner(profile, identity)
    return profile
