"""Perfil local v1: identidad externa explícita y edad derivada."""
from dataclasses import dataclass
from datetime import date
from uuid import UUID


@dataclass(frozen=True)
class User:
    id_usuario: int
    supabase_user_id: UUID
    nombre: str
    fecha_nacimiento: date
    ocupacion: str | None = None
    ciudad: str | None = None
    breve_descripcion: str | None = None
    sobre_mi: str | None = None
    foto_perfil: str | None = None
    presupuesto: int | None = None
    zona_interes: str | None = None

    def age(self, today=None):
        today = today or date.today()
        return today.year - self.fecha_nacimiento.year - ((today.month, today.day) < (self.fecha_nacimiento.month, self.fecha_nacimiento.day))

    def public(self):
        return {"id_usuario_PK": self.id_usuario, "nombre": self.nombre, "edad": self.age(),
                "presupuesto": self.presupuesto, "zona_interes": self.zona_interes,
                "ocupacion": self.ocupacion}
