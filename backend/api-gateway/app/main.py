from contextlib import asynccontextmanager
import logging

import httpx
from fastapi import FastAPI, Request
from starlette.responses import JSONResponse

from .config import Settings
from .proxy import forward


class RouteGuard:
    def __init__(self, app):
        self.app = app

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        path = scope["path"]
        private = path.rstrip("/") == "/usuarios/me"

        async def send_private(message):
            if private and message["type"] == "http.response.start":
                message = {**message, "headers": [(k, v) for k, v in message.get("headers", [])
                                                   if k.lower() != b"cache-control"] +
                                                  [(b"cache-control", b"no-store")]}
            await send(message)

        if path == "/usuarios/me" and scope.get("raw_path", b"") != b"/usuarios/me":
            return await JSONResponse({"detail": "Not Found"}, status_code=404)(scope, receive, send_private)
        await self.app(scope, receive, send_private)

# El Gateway es un proceso dedicado: impedir trazas HTTP de URLs y cabeceras.
# Los loggers hijos de httpcore propagan hasta este NullHandler, no al root.
for name in ("httpx", "httpcore"):
    logger = logging.getLogger(name)
    logger.handlers = [logging.NullHandler()]
    logger.propagate = False


def create_app(settings: Settings | None = None, *, transport=None):
    # El servidor o el runner pueden reconfigurar logging después del import.
    # Aplicar la política al crear cada instancia, antes de usar HTTPX.
    for name in ("httpx", "httpcore"):
        logger = logging.getLogger(name)
        logger.handlers = [logging.NullHandler()]
        logger.propagate = False
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

    app = FastAPI(lifespan=lifespan, docs_url="/docs" if config.local_mode else None, redoc_url=None, openapi_url="/openapi.json" if config.local_mode else None,
                  redirect_slashes=False)
    app.state.settings = config

    app.add_middleware(RouteGuard)

    @app.get("/health")
    async def health():
        return {"status": "ok"}

    app.add_api_route("/usuarios/me", forward, methods=["GET", "PATCH"])
    if config.local_mode:
        from .local_routes import dispatch
        app.add_api_route("/{path:path}",dispatch,methods=["GET","POST","PUT","PATCH","DELETE"])
    return app


app = create_app()
