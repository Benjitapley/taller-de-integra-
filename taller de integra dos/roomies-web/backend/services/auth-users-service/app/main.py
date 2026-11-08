"""Punto de entrada FastAPI del servicio Auth/Users."""

from fastapi import FastAPI

from app.api.routes.health import router as health_router
from app.api.profile_api import register_profile_routes

app = FastAPI(title="Roomies Auth/Users Service")
app.include_router(health_router)
register_profile_routes(app)

# La extensión se habilita explícitamente solo para la topología desechable.
import os
if os.environ.get("ROOMIES_LOCAL_MODE") == "1" or os.environ.get("ROOMIES_RUNTIME_MODE") == "supabase":
    from app.api.routes.local_users import router as local_router
    from backend.service_runtime.http import configure
    from fastapi.staticfiles import StaticFiles
    configure(app)
    app.include_router(local_router)
    if os.environ.get("ROOMIES_IMAGE_DIR"):
        app.mount("/imagenes", StaticFiles(directory=os.environ["ROOMIES_IMAGE_DIR"],check_dir=False),name="local-images")
