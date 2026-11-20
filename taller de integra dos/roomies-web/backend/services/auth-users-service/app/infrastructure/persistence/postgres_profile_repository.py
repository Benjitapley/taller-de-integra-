"""Parameterized PostgreSQL persistence for Auth/Users profiles."""

from datetime import date
from typing import Any, Callable
from uuid import UUID

from app.application.profile_repository import ProfileRepository
from app.application.profiles import ProfileRepositoryUnavailable
from app.domain.profile import ProfilePatch, RoomiesProfile
from app.infrastructure.persistence.settings import PostgresDatabaseSettings


_SELECT_PROFILE = """
SELECT id_usuario, supabase_user_id, nombre, edad, ocupacion, ciudad,
       breve_descripcion, sobre_mi, foto_perfil
  FROM auth_users.usuario
 WHERE supabase_user_id = %s
"""

_EDITABLE_COLUMNS = {
    "edad": "edad",
    "ocupacion": "ocupacion",
    "ciudad": "ciudad",
    "breve_descripcion": "breve_descripcion",
    "sobre_mi": "sobre_mi",
}


class PostgresProfileRepository(ProfileRepository):
    """Uses only the Auth/Users schema and the verified Supabase UUID key.

    `connector` exists for isolated unit tests. Production construction uses
    psycopg and the explicit, local-development-only settings object.
    """

    def __init__(
        self,
        settings: PostgresDatabaseSettings,
        *,
        connector: Callable[[], Any] | None = None,
    ) -> None:
        self._settings = settings
        self._connector = connector or self._connect

    def _connect(self):
        try:
            import psycopg
        except ImportError:
            raise ProfileRepositoryUnavailable() from None
        return psycopg.connect(
            self._settings.database_url,
            connect_timeout=self._settings.connect_timeout_seconds,
        )

    @staticmethod
    def _to_profile(row: tuple[Any, ...]) -> RoomiesProfile:
        return RoomiesProfile(
            id_usuario=row[0],
            supabase_user_id=row[1],
            nombre=row[2],
            edad=row[3],
            ocupacion=row[4],
            ciudad=row[5],
            breve_descripcion=row[6],
            sobre_mi=row[7],
            foto_perfil=row[8],
            # Verification status (D08) is intentionally not stored or inferred.
            verificado=None,
        )

    def get_by_supabase_user_id(self, user_id: UUID) -> RoomiesProfile | None:
        try:
            with self._connector() as connection:
                with connection.cursor() as cursor:
                    cursor.execute(_SELECT_PROFILE, (user_id,))
                    row = cursor.fetchone()
                    return self._to_profile(row) if row is not None else None
        except Exception:
            raise ProfileRepositoryUnavailable() from None

    def patch_by_supabase_user_id(
        self, user_id: UUID, patch: ProfilePatch
    ) -> RoomiesProfile | None:
        requested_changes = patch.changes()
        if not requested_changes or not set(requested_changes).issubset(_EDITABLE_COLUMNS):
            raise ValueError("El PATCH contiene campos no persistibles.")
        changes = {
            name: requested_changes[name]
            for name in _EDITABLE_COLUMNS
            if name in requested_changes
        }

        # Identifiers come only from this fixed allowlist; all values are bound.
        assignments = ", ".join(
            f"{_EDITABLE_COLUMNS[name]} = %s" for name in changes
        )
        statement = (
            "UPDATE auth_users.usuario SET "
            f"{assignments} WHERE supabase_user_id = %s "
            "RETURNING id_usuario, supabase_user_id, nombre, edad, ocupacion, ciudad, "
            "breve_descripcion, sobre_mi, foto_perfil"
        )
        parameters = (*changes.values(), user_id)

        try:
            with self._connector() as connection:
                with connection.cursor() as cursor:
                    cursor.execute(statement, parameters)
                    row = cursor.fetchone()
                    return self._to_profile(row) if row is not None else None
        except Exception:
            # Do not leak SQL, connection strings, driver diagnostics, or PII.
            raise ProfileRepositoryUnavailable() from None

    def ensure_profile(
        self, user_id: UUID, *, nombre: str, fecha_nacimiento: date
    ) -> RoomiesProfile:
        """Insert once by UUID; a retry returns the existing row unchanged."""

        insert_statement = """
        INSERT INTO auth_users.usuario (supabase_user_id, nombre, fecha_nacimiento)
        VALUES (%s, %s, %s)
        ON CONFLICT (supabase_user_id) DO NOTHING
        RETURNING id_usuario, supabase_user_id, nombre, edad, ocupacion, ciudad,
                  breve_descripcion, sobre_mi, foto_perfil
        """
        try:
            with self._connector() as connection:
                with connection.cursor() as cursor:
                    cursor.execute(insert_statement, (user_id, nombre, fecha_nacimiento))
                    row = cursor.fetchone()
                    if row is None:
                        cursor.execute(_SELECT_PROFILE, (user_id,))
                        row = cursor.fetchone()
                    if row is None:
                        # Can occur only if a concurrent deletion races the retry.
                        raise ProfileRepositoryUnavailable()
                    return self._to_profile(row)
        except ProfileRepositoryUnavailable:
            raise
        except Exception:
            raise ProfileRepositoryUnavailable() from None
