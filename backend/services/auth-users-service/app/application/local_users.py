"""Casos de uso locales sin SQL, FastAPI ni Supabase."""
from typing import Protocol
from datetime import date
from uuid import UUID
from app.domain.local_users import User
from app.domain.profile import ProfileInitialization
from backend.service_runtime.contracts import RuleViolation


class UsersRepository(Protocol):
    def get(self, subject: UUID) -> User | None: ...
    def ensure(self, subject: UUID, name: str, birth_date: date) -> User: ...
    def patch(self, subject: UUID, changes: dict) -> User | None: ...
    def public_search(self, filters: dict) -> list[User]: ...
    def notify(self, event: dict): ...
    def notifications(self, user_id: int) -> list[dict]: ...
    def count(self) -> int: ...


class Users:
    def __init__(self, repository: UsersRepository):
        self.repository = repository

    def own(self, subject):
        user = self.repository.get(subject)
        if user is None:
            raise RuleViolation("Completa la inicialización de tu perfil.", 404)
        if user.supabase_user_id != subject:
            raise RuleViolation("Perfil no disponible.", 403)
        return user

    def initialize(self, subject, name, birth_date, confirmed):
        if not confirmed:
            raise RuleViolation("Confirma tu correo antes de inicializar el perfil.", 403)
        try:
            initial = ProfileInitialization(name, birth_date)
            today = date.today()
            age = today.year - birth_date.year - ((today.month, today.day) < (birth_date.month, birth_date.day))
            if age > 120:
                raise ValueError("Fecha de nacimiento fuera de rango.")
        except ValueError as error:
            raise RuleViolation(str(error)) from None
        user = self.repository.ensure(subject, initial.nombre, initial.fecha_nacimiento)
        if user.supabase_user_id != subject:
            raise RuleViolation("Perfil no disponible.", 403)
        return user

    def update(self, subject, changes):
        user = self.own(subject)
        limits = {"ocupacion":100,"ciudad":100,"breve_descripcion":255,"sobre_mi":5000,"zona_interes":250,"foto_perfil":255}
        if set(changes) - {*limits, "presupuesto"}:
            raise RuleViolation("Campo de perfil no editable.")
        normalized = {}
        for key, value in changes.items():
            if key == "presupuesto":
                if value is not None and (type(value) is not int or not 0 <= value <= 2147483647):
                    raise RuleViolation("Presupuesto inválido.")
                normalized[key] = value
            else:
                if value is not None and (not isinstance(value, str) or len(value) > limits[key] or "\x00" in value):
                    raise RuleViolation("Campo de perfil inválido.")
                normalized[key] = (value.strip() or None) if value else None
        updated = self.repository.patch(subject, normalized) if normalized else user
        if updated is None or updated.supabase_user_id != subject:
            raise RuleViolation("Perfil no disponible.", 404)
        return updated
