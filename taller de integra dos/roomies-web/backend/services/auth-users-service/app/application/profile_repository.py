"""Persistence port for Roomies profiles; no production adapter is configured."""

from datetime import date
from typing import Protocol
from uuid import UUID

from app.domain.profile import ProfilePatch, RoomiesProfile


class ProfileRepository(Protocol):
    """Repository keyed only by the verified Supabase UUID.

    A production adapter must resolve the explicit UUID-to-integer mapping in
    the agreed Users schema. It must not search by email or cast UUID to int.
    """

    def get_by_supabase_user_id(self, user_id: UUID) -> RoomiesProfile | None:
        """Return the profile linked to this Supabase identity, if it exists."""

    def patch_by_supabase_user_id(
        self, user_id: UUID, patch: ProfilePatch
    ) -> RoomiesProfile | None:
        """Apply only supplied editable fields; return None when absent."""

    def ensure_profile(
        self, user_id: UUID, *, nombre: str, fecha_nacimiento: date
    ) -> RoomiesProfile:
        """Create once by provider UUID, or return the existing profile unchanged."""
