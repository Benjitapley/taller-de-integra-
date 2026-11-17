"""Aplicación FastAPI independiente para ejecutar el router Auth existente."""

from fastapi import FastAPI

from backend.auth_service.main import auth_router

app = FastAPI(title="Roomies Auth Service")
app.include_router(auth_router)


@app.get("/health", tags=["Salud"], include_in_schema=False)
def health() -> dict[str, str]:
    """Indica que el proceso HTTP está disponible, sin consultar servicios externos."""
    return {"status": "ok"}
