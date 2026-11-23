"""Provisional HTTP DTOs for D05 profile routes."""

from pydantic import BaseModel, ConfigDict, field_validator, model_validator

from app.domain.profile import ProfilePatch, ProfileRuleViolation


class ProfilePatchRequest(BaseModel):
    """Partial JSON update; omitted keys stay unchanged and null clears a field."""

    model_config = ConfigDict(extra="forbid")

    edad: int | None = None
    ocupacion: str | None = None
    ciudad: str | None = None
    breve_descripcion: str | None = None
    sobre_mi: str | None = None

    @field_validator("edad", mode="before")
    @classmethod
    def validate_age(cls, value: object) -> int | None:
        if value is None:
            return None
        if type(value) is not int or not 0 <= value <= 120:
            raise ValueError("edad debe ser un entero entre 0 y 120, o nulo.")
        return value

    @field_validator("ocupacion", "ciudad", "breve_descripcion", "sobre_mi", mode="before")
    @classmethod
    def validate_text(cls, value: object, info) -> str | None:
        if value is None:
            return None
        if not isinstance(value, str):
            raise ValueError(f"{info.field_name} debe ser texto o nulo.")
        try:
            return ProfilePatch(
                fields_set=frozenset({info.field_name}),
                **{info.field_name: value},
            ).changes()[info.field_name]
        except ProfileRuleViolation as exc:
            raise ValueError(str(exc)) from None

    @model_validator(mode="after")
    def require_at_least_one_field(self) -> "ProfilePatchRequest":
        if not self.model_fields_set:
            raise ValueError("El PATCH debe incluir al menos un campo editable.")
        return self

    def to_patch(self) -> ProfilePatch:
        supplied = frozenset(self.model_fields_set)
        values = {name: getattr(self, name) for name in supplied}
        return ProfilePatch(fields_set=supplied, **values)


class ProfileResponse(BaseModel):
    """Profile-owned fields only; excludes Listado's count and unresolved D08 flag."""

    model_config = ConfigDict(from_attributes=True)

    nombre: str
    edad: int | None
    ocupacion: str | None
    ciudad: str | None
    breve_descripcion: str | None
    sobre_mi: str | None
    foto_perfil: str | None
