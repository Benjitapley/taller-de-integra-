import asyncio
from contextlib import asynccontextmanager
import hmac
import os
from typing import Annotated
from uuid import UUID

from fastapi import Depends, FastAPI, Header, Path, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from backend.service_runtime.contracts import DependencyUnavailable
from backend.service_runtime.http import configure
from backend.service_runtime.security import confirmed_actor
from app.models import ErrorResponse, Incorporation, Receipt, Removal, Rental, ServiceError, unavailable
from app.ports import HttpIdentity, HttpPublications
from app.repository import PostgresRepository
from app.service import Convivencia


def internal_service(x_roomies_service: Annotated[str | None, Header()] = None):
    expected = os.environ.get("ROOMIES_INTERNAL_TOKEN", "")
    if len(expected) < 32 or not expected.isascii():
        raise unavailable()
    if x_roomies_service is None or not x_roomies_service.isascii() or not hmac.compare_digest(expected, x_roomies_service):
        raise ServiceError("FORBIDDEN", "Credencial de servicio inválida.", 403)


def service(request: Request):
    return request.app.state.convivencia


def create_app(instance=None, run_recovery=True):
    @asynccontextmanager
    async def lifespan(application):
        stopped = asyncio.Event()

        async def recover():
            while not stopped.is_set():
                try:
                    await asyncio.to_thread(application.state.convivencia.recover)
                except Exception:
                    pass  # La operación y la outbox durables se reanudan al recuperar dependencias.
                try:
                    await asyncio.wait_for(stopped.wait(), timeout=2)
                except TimeoutError:
                    pass

        task = asyncio.create_task(recover()) if run_recovery else None
        try:
            yield
        finally:
            stopped.set()
            if task is not None:
                await task

    application = FastAPI(title="Roomies Convivencia - base de incorporación v1", version="1.0.0", lifespan=lifespan)
    application.state.convivencia = instance or Convivencia(PostgresRepository(), HttpIdentity(), HttpPublications())
    configure(application)

    @application.exception_handler(ServiceError)
    async def service_error(request, error):
        return JSONResponse(error.body, status_code=error.status, headers={"Cache-Control": "no-store"})

    @application.exception_handler(DependencyUnavailable)
    @application.exception_handler(Exception)
    async def dependency_error(request, error):
        value = unavailable()
        return JSONResponse(value.body, status_code=503, headers={"Cache-Control": "no-store"})

    @application.exception_handler(RequestValidationError)
    async def validation_error(request, error):
        return JSONResponse({"detail": "Payload, ruta o cabeceras inválidos.", "code": "INVALID_REQUEST"}, status_code=422)

    @application.exception_handler(StarletteHTTPException)
    async def http_error(request, error):
        codes = {401: "UNAUTHENTICATED", 403: "FORBIDDEN", 404: "NOT_FOUND", 405: "METHOD_NOT_ALLOWED", 503: "DEPENDENCY_UNAVAILABLE"}
        return JSONResponse({"detail": str(error.detail), "code": codes.get(error.status_code, "REQUEST_REJECTED")}, status_code=error.status_code, headers=error.headers)

    @application.get("/health")
    def health():
        return {"status": "ok", "scope": "base-incorporacion-v1"}

    errors = {status: {"model": ErrorResponse} for status in (401, 403, 404, 409, 422, 503)}

    @application.post("/internal/incorporaciones", dependencies=[Depends(internal_service)], status_code=201, response_model=Receipt, responses=errors)
    def incorporate(data: Incorporation, idempotency_key: Annotated[UUID, Header()], application_service=Depends(service)):
        status, body, replay = application_service.incorporate(idempotency_key, data.model_dump())
        return JSONResponse(body, status_code=status, headers={"Idempotency-Replayed": str(replay).lower()})

    @application.get("/api/arriendos/mio", response_model=Rental, responses=errors)
    def mine(identity=Depends(confirmed_actor), application_service=Depends(service)):
        return application_service.repository.mine(identity.user_id)

    @application.get("/api/arriendos/{id}", response_model=Rental, responses=errors)
    def detail(id: Annotated[int, Path(gt=0, le=9223372036854775807)], identity=Depends(confirmed_actor), application_service=Depends(service)):
        return application_service.repository.get(id, identity.user_id)

    @application.post("/api/arriendos/{id}/expulsiones", status_code=201, responses=errors)
    def expel(
        id: Annotated[int, Path(gt=0, le=9223372036854775807)],
        data: Removal,
        idempotency_key: Annotated[UUID, Header()],
        identity=Depends(confirmed_actor),
        application_service=Depends(service),
    ):
        status, body, replay = application_service.expel(
            id,
            identity.user_id,
            data.id_usuario,
            data.motivo,
            idempotency_key,
        )
        return JSONResponse(
            body,
            status_code=status,
            headers={"Idempotency-Replayed": str(replay).lower()},
        )

    return application


app = create_app()
