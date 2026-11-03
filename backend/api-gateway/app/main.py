from contextlib import asynccontextmanager
import logging

import httpx
from fastapi import FastAPI, Request
from starlette.responses import JSONResponse

from .config import Settings
from .proxy import forward

# El Gateway es un proceso dedicado: impedir trazas HTTP de URLs y cabeceras.
# Los loggers hijos de httpcore propagan hasta este NullHandler, no al root.
for name in ("httpx", "httpcore"):
    logger = logging.getLogger(name)
    logger.handlers = [logging.NullHandler()]
    logger.propagate = False


def create_app(settings: Settings | None = None, *, transport=None):
    config = settings if settings is not None else Settings.from_env()

    @asynccontextmanager
    async def lifespan(app):
        timeout = httpx.Timeout(connect=config.connect_timeout, read=config.read_timeout,
                                write=config.write_timeout, pool=config.pool_timeout)
        active_transport = transport if transport is not None else httpx.AsyncHTTPTransport(
            retries=0, trust_env=False)
        async with httpx.AsyncClient(timeout=timeout, follow_redirects=False,
                                     trust_env=False, transport=active_transport) as client:
            app.state.client = client
            yield

    app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None,
                  redirect_slashes=False)
    app.state.settings = config

    @app.middleware("http")
    async def route_guard(request: Request, call_next):
        # No aceptar alias codificados ni normalizaciones para la ruta privada.
        raw_path = request.scope.get("raw_path", b"")
        path = request.scope["path"]
        private = path.rstrip("/") == "/usuarios/me"
        if path == "/usuarios/me" and raw_path != b"/usuarios/me":
            response = JSONResponse({"detail": "Not Found"}, status_code=404)
        else:
            response = await call_next(request)
        if private:
            response.headers["Cache-Control"] = "no-store"
        return response

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    app.add_api_route("/usuarios/me", forward, methods=["GET", "PATCH"])
    return app


app = create_app()
