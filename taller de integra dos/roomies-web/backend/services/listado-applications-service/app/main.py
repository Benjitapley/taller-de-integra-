"""Aplicación independiente Listado/Applications local."""
import asyncio
from contextlib import asynccontextmanager
import os
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from app.api.routes import router
from app.infrastructure.repository import PostgresPublications
from app.infrastructure.clients import HttpNotifications
from app.application.notifications import dispatch
from backend.service_runtime.http import configure


@asynccontextmanager
async def lifespan(app):
    stopped=asyncio.Event()
    async def deliver():
        while not stopped.is_set():
            try: await asyncio.to_thread(dispatch,PostgresPublications(),HttpNotifications())
            except Exception: pass  # La outbox persiste hasta poder entregar.
            try: await asyncio.wait_for(stopped.wait(),timeout=1)
            except TimeoutError: pass
    task=asyncio.create_task(deliver())
    try:
        yield
    finally:
        stopped.set()
        await task


app=FastAPI(title="Roomies Listado/Applications local v1",lifespan=lifespan)
configure(app)
app.include_router(router)
@app.get("/health")
def health(): return {"status":"ok"}
if os.environ.get("ROOMIES_IMAGE_DIR"):
    app.mount("/imagenes",StaticFiles(directory=os.environ["ROOMIES_IMAGE_DIR"],check_dir=False),name="local-images")
