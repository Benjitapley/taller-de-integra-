import asyncio
import logging
from contextlib import asynccontextmanager

import psycopg
from fastapi import FastAPI

from app.api.routes import router
from app.application.service import Convivencia
from app.infrastructure.clients import HttpListingCapacity
from app.infrastructure.repository import PostgresConvivencia
from backend.service_runtime.contracts import DependencyUnavailable
from backend.service_runtime.http import configure

logger = logging.getLogger("convivencia.outbox")


@asynccontextmanager
async def lifespan(app):
    stopped = asyncio.Event()

    async def dispatch():
        while not stopped.is_set():
            try:
                await asyncio.to_thread(
                    Convivencia(PostgresConvivencia(), HttpListingCapacity()).deliver_outbox
                )
            except (DependencyUnavailable, psycopg.Error) as error:
                logger.warning("outbox delivery deferred: %s", type(error).__name__)
            try:
                await asyncio.wait_for(stopped.wait(), timeout=1)
            except TimeoutError:
                pass

    worker = asyncio.create_task(dispatch())
    try:
        yield
    finally:
        stopped.set()
        await worker


app = FastAPI(title="Roomies Convivencia/Mensajería v1", lifespan=lifespan)
configure(app)
app.include_router(router)


@app.get("/health")
def health():
    return {"status": "ok"}
