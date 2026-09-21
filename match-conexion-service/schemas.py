from pydantic import BaseModel, Field
from typing import Optional

class FiltrosBusquedaUsuario(BaseModel):
    edad_min: Optional[int] = Field(18, ge=18, description="Edad mínima (BR-01 exige 18 años)")
    edad_max: Optional[int] = Field(None, description="Edad máxima")
    presupuesto_max: Optional[int] = Field(None, description="Presupuesto máximo del usuario")
    zona: Optional[str] = Field(None, description="Zona de interés")
    ocupacion: Optional[str] = Field(None, description="Ocupación o condición de estudio/trabajo")