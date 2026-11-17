"""Roomies profile data and rules that do not depend on persistence or HTTP."""

from dataclasses import dataclass
from datetime import date
from uuid import UUID


PROFILE_TEXT_LIMITS = {
    "ocupacion": 100,
    "ciudad": 100,
    "breve_descripcion": 255,
    "sobre_mi": 5000,
}
PROFILE_EDITABLE_FIELDS = frozenset(
    {"edad", "ocupacion", "ciudad", "breve_descripcion", "sobre_mi"}
)


class ProfileRuleViolation(ValueError):
    """A profile value violates a rule already enforced by the current API."""


@dataclass(frozen=True, slots=True)
class ProfileInitialization:
    """Validated data needed by the proposed, authenticated D02 initialization flow.

    This is an application input, not an approved public HTTP DTO. The email-
    confirmation check must happen in the future orchestration before use.
    """

    nombre: str
    fecha_nacimiento: date

    def __post_init__(self) -> None:
        if not isinstance(self.nombre, str):
            raise ProfileRuleViolation("nombre debe ser texto.")
        normalized_name = self.nombre.strip()
        if not normalized_name or len(normalized_name) > 200 or "\x00" in normalized_name:
            raise ProfileRuleViolation("nombre no es válido.")
        object.__setattr__(self, "nombre", normalized_name)

        if type(self.fecha_nacimiento) is not date:
            raise ProfileRuleViolation("fecha_nacimiento debe ser una fecha válida.")
        today = date.today()
        age = today.year - self.fecha_nacimiento.year - (
            (today.month, today.day)
            < (self.fecha_nacimiento.month, self.fecha_nacimiento.day)
        )
        if age < 18:
            raise ProfileRuleViolation("La cuenta debe corresponder a una persona mayor de edad.")


def _validate_text(value: object, field_name: str, max_length: int) -> str:
    if not isinstance(value, str):
        raise ProfileRuleViolation(f"{field_name} debe ser texto.")
    normalized = value.strip()
    if len(normalized) > max_length or "\x00" in normalized:
        raise ProfileRuleViolation(f"{field_name} excede el límite permitido.")
    return normalized


@dataclass(frozen=True, slots=True)
class RoomiesProfile:
    """Profile with separate provider and Roomies identifiers.

    `verificado` is retained as an observed legacy field only. Its meaning and
    source after moving identity to Supabase remain a team decision (D08).
    `total_publicaciones` is deliberately absent because it belongs to Listado.
    """

    id_usuario: int
    supabase_user_id: UUID
    nombre: str
    edad: int | None
    ocupacion: str | None
    ciudad: str | None
    breve_descripcion: str | None
    sobre_mi: str | None
    foto_perfil: str | None
    verificado: bool | None

    def __post_init__(self) -> None:
        if type(self.id_usuario) is not int or self.id_usuario <= 0:
            raise ProfileRuleViolation("id_usuario debe ser un entero positivo de Roomies.")
        if not isinstance(self.supabase_user_id, UUID):
            raise ProfileRuleViolation("supabase_user_id debe ser un UUID verificado.")
        if not isinstance(self.nombre, str) or not self.nombre.strip() or len(self.nombre) > 200:
            raise ProfileRuleViolation("nombre no es válido.")
        if self.edad is not None and (
            type(self.edad) is not int or not 0 <= self.edad <= 120
        ):
            raise ProfileRuleViolation("edad debe estar entre 0 y 120.")
        for name, limit in PROFILE_TEXT_LIMITS.items():
            value = getattr(self, name)
            if value is not None:
                _validate_text(value, name, limit)
        if self.foto_perfil is not None and not isinstance(self.foto_perfil, str):
            raise ProfileRuleViolation("foto_perfil debe ser texto o nulo.")
        if self.verificado is not None and type(self.verificado) is not bool:
            raise ProfileRuleViolation("verificado debe ser booleano o nulo.")


@dataclass(frozen=True, slots=True)
class ProfilePatch:
    """Partial update preserving the distinction between absent and null.

    `fields_set` records which keys the client actually sent. A key in that
    set with value `None` explicitly clears the nullable field; a key outside
    the set is left unchanged. Photo upload remains outside this proposal.
    """

    fields_set: frozenset[str]
    edad: int | None = None
    ocupacion: str | None = None
    ciudad: str | None = None
    breve_descripcion: str | None = None
    sobre_mi: str | None = None

    def __post_init__(self) -> None:
        provided = frozenset(self.fields_set)
        if not provided:
            raise ProfileRuleViolation("El PATCH debe incluir al menos un campo editable.")
        if not provided.issubset(PROFILE_EDITABLE_FIELDS):
            raise ProfileRuleViolation("El PATCH contiene campos no editables.")
        object.__setattr__(self, "fields_set", provided)

        if "edad" in provided and self.edad is not None and (
            type(self.edad) is not int or not 0 <= self.edad <= 120
        ):
            raise ProfileRuleViolation("edad debe ser un entero entre 0 y 120, o nulo.")
        for name, limit in PROFILE_TEXT_LIMITS.items():
            if name in provided and getattr(self, name) is not None:
                normalized = _validate_text(getattr(self, name), name, limit)
                object.__setattr__(self, name, normalized)

    def changes(self) -> dict[str, int | str | None]:
        """Return only supplied editable fields, including explicit nulls."""

        return {name: getattr(self, name) for name in self.fields_set}
