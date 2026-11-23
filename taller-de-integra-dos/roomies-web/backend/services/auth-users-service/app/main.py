"""Punto de entrada FastAPI del servicio Auth/Users."""

from fastapi import FastAPI

from app.api.routes.health import router as health_router
from app.api.profile_api import register_profile_routes

import asyncio
from contextlib import asynccontextmanager

@asynccontextmanager
async def lifespan(app):
    stop=asyncio.Event()
    async def cleanup():
        from app.infrastructure.profile_images import cleanup_previous
        while not stop.is_set():
            try: await asyncio.to_thread(cleanup_previous)
            except Exception: pass  # La cola SQL conserva la limpieza para reintento.
            try: await asyncio.wait_for(stop.wait(),timeout=2)
            except TimeoutError: pass
    import os
    task=asyncio.create_task(cleanup()) if os.environ.get("ROOMIES_RUNTIME_MODE")=="supabase" or os.environ.get("ROOMIES_LOCAL_MODE")=="1" else None
    try: yield
    finally:
        stop.set()
        if task: await task

app = FastAPI(title="Roomies Auth/Users Service",lifespan=lifespan)
app.include_router(health_router)

# Supabase y la topología desechable comparten el contrato de perfil.
import os
if os.environ.get("ROOMIES_LOCAL_MODE") == "1" or os.environ.get("ROOMIES_RUNTIME_MODE") == "supabase":
    from app.api.routes.local_users import router as local_router
    from backend.service_runtime.http import configure
    from fastapi.staticfiles import StaticFiles
    configure(app)
    app.include_router(local_router)
    from app.api.routes.canonical_profile import router as canonical_router
    app.include_router(canonical_router)
    if os.environ.get("ROOMIES_IMAGE_DIR"):
        app.mount("/imagenes", StaticFiles(directory=os.environ["ROOMIES_IMAGE_DIR"],check_dir=False),name="local-images")
else:
    register_profile_routes(app)
