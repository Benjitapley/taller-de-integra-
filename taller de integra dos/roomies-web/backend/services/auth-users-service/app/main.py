"""Punto de entrada FastAPI del servicio Auth/Users."""

import asyncio
import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api.routes.health import router as health_router
from app.api.profile_api import register_profile_routes


async def clean_profile_photos(stop):
    from app.infrastructure.persistence.local_users import PostgresUsers
    from app.infrastructure.profile_storage import ProfileStorage

    repository = PostgresUsers()
    while not stop.is_set():
        try:
            await asyncio.to_thread(repository.clean_photos, ProfileStorage().delete)
        except Exception:
            logging.getLogger(__name__).warning("No se pudo procesar la limpieza de fotos de perfil.")
        try:
            await asyncio.wait_for(stop.wait(), timeout=30)
        except TimeoutError:
            pass


@asynccontextmanager
async def lifespan(application):
    stop = asyncio.Event()
    task = None
    if os.environ.get("ROOMIES_RUNTIME_MODE") == "supabase" and os.environ.get("ROOMIES_PROFILE_STORAGE_SECRET_KEY"):
        task = asyncio.create_task(clean_profile_photos(stop))
    try:
        yield
    finally:
        stop.set()
        if task is not None:
            await task


app = FastAPI(title="Roomies Auth/Users Service", lifespan=lifespan)
app.include_router(health_router)

# Supabase y la topología desechable comparten el contrato de perfil.
if os.environ.get("ROOMIES_LOCAL_MODE") == "1" or os.environ.get("ROOMIES_RUNTIME_MODE") == "supabase":
    from app.api.routes.local_users import router as local_router
    from backend.service_runtime.http import configure
    from fastapi.staticfiles import StaticFiles
    configure(app)
    app.include_router(local_router)
    if os.environ.get("ROOMIES_IMAGE_DIR"):
        app.mount("/imagenes", StaticFiles(directory=os.environ["ROOMIES_IMAGE_DIR"],check_dir=False),name="local-images")
else:
    register_profile_routes(app)
