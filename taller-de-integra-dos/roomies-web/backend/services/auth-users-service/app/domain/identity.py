"""Identidad autenticada del proveedor; no representa el ID de negocio Roomies."""

from dataclasses import dataclass
from uuid import UUID


@dataclass(frozen=True, slots=True)
class VerifiedIdentity:
    supabase_user_id: UUID
