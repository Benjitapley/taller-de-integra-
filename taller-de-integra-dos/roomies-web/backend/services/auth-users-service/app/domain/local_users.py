"""Perfil local v1: identidad externa explícita y edad derivada."""
from dataclasses import dataclass
from datetime import date
from uuid import UUID

from app.domain.profile import age_on


@dataclass(frozen=True)
class User:
    id_usuario: int
    supabase_user_id: UUID | None
    nombre: str
    fecha_nacimiento: date | None
    ocupacion: str | None = None
    ciudad: str | None = None
    breve_descripcion: str | None = None
    sobre_mi: str | None = None
    foto_perfil: str | None = None
    presupuesto: int | None = None
    zona_interes: str | None = None

    def age(self, today: date | None = None) -> int | None:
        if self.fecha_nacimiento is None:
            return None
        age = age_on(self.fecha_nacimiento, today or date.today())
        return age if 0 <= age <= 120 else None

    def public(self):
        return {"id_usuario_PK": self.id_usuario, "nombre": self.nombre, "edad": self.age(),
                "presupuesto": self.presupuesto, "zona_interes": self.zona_interes,
                "ocupacion": self.ocupacion}
