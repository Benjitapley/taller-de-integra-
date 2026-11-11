"""Contratos internos locales v1. Tipos puros, sin proveedores ni HTTP."""
from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True)
class Actor:
    subject: UUID
    user_id: int
    email_confirmed: bool
    administrator: bool = False


class RuleViolation(Exception):
    def __init__(self, message, status=422):
        self.message, self.status = message, status
        super().__init__(message)


class DependencyUnavailable(Exception):
    pass
