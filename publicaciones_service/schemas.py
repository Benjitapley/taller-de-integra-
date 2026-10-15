"""Validación compartida por el servicio y la API actual de publicaciones."""

import json
from decimal import Decimal
from typing import Literal

from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    ValidationInfo,
    field_validator,
    model_validator,
)


TipoMascota = Literal["perro", "gato", "ave", "tortuga", "conejo", "pez", "otro"]


class PreferenciasMascotas(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    mascota: Literal["si", "no"] = "no"
    tipos_mascotas_aceptadas: list[TipoMascota] = Field(default_factory=list, max_length=7)
    condiciones_mascotas: str | None = Field(default=None, max_length=2000)

    @field_validator("tipos_mascotas_aceptadas")
    @classmethod
    def quitar_repetidos(cls, tipos):
        return list(dict.fromkeys(tipos))

    @field_validator("condiciones_mascotas")
    @classmethod
    def normalizar_condiciones(cls, condiciones):
        return condiciones or None

    @model_validator(mode="after")
    def validar_preferencias(self, info: ValidationInfo):
        if self.mascota == "no":
            self.tipos_mascotas_aceptadas = []
            self.condiciones_mascotas = None
            return self

        permitir_sin_tipos = (info.context or {}).get("permitir_sin_tipos", False)
        if not self.tipos_mascotas_aceptadas and not permitir_sin_tipos:
            raise ValueError("Selecciona al menos un tipo de mascota aceptada.")
        if "otro" in self.tipos_mascotas_aceptadas and not self.condiciones_mascotas:
            raise ValueError("Indica en las condiciones qué otro animal se acepta.")
        return self


def preferencias_desde_formulario(
    mascota: str,
    tipos_json: str | None,
    condiciones: str | None,
    anteriores: dict | None = None,
) -> PreferenciasMascotas:
    """Lee la lista JSON dentro de FormData y conserva preferencias antiguas."""
    anteriores = anteriores or {}
    tipos_anteriores = anteriores.get("tipos_mascotas_aceptadas") or []
    condiciones_anteriores = (anteriores.get("condiciones_mascotas") or "").strip() or None

    if tipos_json is None:
        tipos = tipos_anteriores
    else:
        try:
            tipos = json.loads(tipos_json)
        except (json.JSONDecodeError, TypeError):
            raise ValueError("Los tipos de mascotas deben enviarse como una lista JSON.") from None

    # Los clientes anteriores no enviaban ninguno de los dos campos nuevos.
    if tipos_json is None and condiciones is None:
        condiciones = condiciones_anteriores
    condiciones = (condiciones or "").strip() or None

    conservar_legacy = (
        anteriores.get("mascota") == "si"
        and mascota == "si"
        and not tipos_anteriores
        and tipos == []
        and condiciones == condiciones_anteriores
    )

    return PreferenciasMascotas.model_validate(
        {
            "mascota": mascota,
            "tipos_mascotas_aceptadas": tipos,
            "condiciones_mascotas": condiciones,
        },
        context={"permitir_sin_tipos": conservar_legacy},
    )


class PublicacionCrear(PreferenciasMascotas):
    titulo: str = Field(min_length=1, max_length=200)
    descripcion: str = Field(min_length=1, max_length=5000)
    precio: Decimal = Field(ge=0, max_digits=14, decimal_places=2)
    ubicacion: str = Field(min_length=1, max_length=250)
    categoria: Literal["busco", "ofrezco"]
    tipo: Literal["Arrendador", "Compartida"]
    tipo_vivienda: Literal["casa", "departamento", "habitacion"]
    cupos_totales: int = Field(ge=1, le=2147483647)
    permitir_comentarios: bool = False
