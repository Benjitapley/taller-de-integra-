"""Comprobación HTTP de vida del proceso, sin consultar dependencias externas."""

from fastapi import APIRouter

router = APIRouter(tags=["Salud"])


@router.get("/health", response_model=dict[str, str])
def health() -> dict[str, str]:
    return {"status": "ok"}
