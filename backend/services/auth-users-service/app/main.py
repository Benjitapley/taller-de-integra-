"""Punto de entrada FastAPI del servicio Auth/Users."""

from fastapi import FastAPI

from app.api.routes.health import router as health_router
from app.api.profile_api import register_profile_routes

app = FastAPI(title="Roomies Auth/Users Service")
app.include_router(health_router)
register_profile_routes(app)
