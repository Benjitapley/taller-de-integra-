"""Aplicación independiente Listado/Applications local."""
import asyncio
from contextlib import asynccontextmanager
import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from app.api.routes import router
from app.infrastructure.repository import PostgresPublications
from app.infrastructure.clients import HttpNotifications, UnavailableOccupancy
from app.application.service import Publications
from app.application.admissions import Admissions
from app.application.notifications import dispatch
from app.application.images import cleanup_images
from app.infrastructure.image_operations import ImageOperations
from app.infrastructure.storage import SupabasePublicationImages
from backend.service_runtime.http import configure


@asynccontextmanager
async def lifespan(app):
    stopped=asyncio.Event()
    async def deliver():
        while not stopped.is_set():
            try: await asyncio.to_thread(dispatch,PostgresPublications(),HttpNotifications())
            except Exception: pass  # La outbox persiste hasta poder entregar.
            try: await asyncio.to_thread(cleanup_images,ImageOperations(PostgresPublications()),SupabasePublicationImages())
            except Exception: pass  # El journal conserva las limpiezas para el siguiente intento.
            try: await asyncio.to_thread(Admissions(Publications(PostgresPublications(),UnavailableOccupancy(),SupabasePublicationImages())).recover)
            except Exception: pass  # Cada admisión conserva su clave y etapa hasta completar el recibo.
            try: await asyncio.wait_for(stopped.wait(),timeout=1)
            except TimeoutError: pass
    task=asyncio.create_task(deliver())
    try:
        yield
    finally:
        stopped.set()
        await task


app=FastAPI(title="Roomies Listado/Applications",version="S3R-C03-v1",lifespan=lifespan)
configure(app)
app.include_router(router)
@app.get("/health")
def health(): return {"status":"ok"}
if os.environ.get("ROOMIES_IMAGE_DIR"):
    app.mount("/imagenes",StaticFiles(directory=os.environ["ROOMIES_IMAGE_DIR"],check_dir=False),name="local-images")
