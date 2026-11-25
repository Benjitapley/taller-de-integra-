import asyncio
import logging
import os
from contextlib import asynccontextmanager
from typing import Annotated
from uuid import UUID

from fastapi import Depends, FastAPI, Header, Path, Query
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from backend.service_runtime.contracts import Actor, DependencyUnavailable, RuleViolation
from backend.service_runtime.http import configure
from backend.service_runtime.security import actor, admin_actor, confirmed_actor
from app.models import AdminReportDetail, AdminReportPage, MAX_ID, Report, ReportInput, ReportPage, ReportStatus, ReportType, ReviewInput
from app.notifications import NotificationDelivery
from app.relationships import Relationships
from app.repository import ReportRepository
from app.service import IdempotencyConflict, Reports


async def deliver_notifications(stop):
    delivery = NotificationDelivery(ReportRepository())
    while not stop.is_set():
        try:
            if await asyncio.to_thread(delivery.deliver_next):
                continue
        except Exception:
            logging.getLogger(__name__).warning("No se pudo procesar la cola de notificaciones de reportes.")
        try:
            await asyncio.wait_for(stop.wait(), timeout=2)
        except TimeoutError:
            pass


@asynccontextmanager
async def lifespan(application):
    stop = asyncio.Event()
    task = asyncio.create_task(deliver_notifications(stop)) if os.environ.get("REPORTES_AUTH_JWT_KEY") else None
    try:
        yield
    finally:
        stop.set()
        if task is not None:
            await task


app = FastAPI(title="Roomies Reportes", lifespan=lifespan)
configure(app)
ERRORS = {401: "NO_AUTENTICADO", 403: "PROHIBIDO", 404: "NO_ENCONTRADO", 409: "TRANSICION_INVALIDA",
          422: "SOLICITUD_INVALIDA", 503: "DEPENDENCIA_NO_DISPONIBLE"}


def error(status, message, headers=None, **extra):
    return JSONResponse(
        {"codigo": ERRORS.get(status, "SOLICITUD_RECHAZADA"), "mensaje": message, **extra},
        status_code=status, headers={**(headers or {}), "Cache-Control": "no-store"},
    )


@app.exception_handler(HTTPException)
async def http_error(request, exc):
    return error(exc.status_code, str(exc.detail), exc.headers)


@app.exception_handler(RuleViolation)
async def rule_error(request, exc):
    return error(exc.status, exc.message)


@app.exception_handler(IdempotencyConflict)
async def idempotency_error(request, exc):
    return error(exc.status, exc.message, codigo="CLAVE_IDEMPOTENCIA_REUTILIZADA")


@app.exception_handler(DependencyUnavailable)
@app.exception_handler(Exception)
async def dependency_error(request, exc):
    return error(503, "No se pudo completar la operación de reportes.")


@app.exception_handler(RequestValidationError)
async def validation_error(request, exc):
    details = [
        {"campo": ".".join(str(part) for part in item["loc"][1:]) or str(item["loc"][0]), "mensaje": item["msg"]}
        for item in exc.errors()
    ]
    return error(422, "Revisa los datos del reporte.", detalles=details)


def reports():
    return Reports(ReportRepository(), Relationships())


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/api/reportes", status_code=201, response_model=Report)
def create(
    data: ReportInput,
    identity: Annotated[Actor, Depends(confirmed_actor)],
    service: Annotated[Reports, Depends(reports)],
    idempotency_key: Annotated[UUID | None, Header()] = None,
):
    return service.create(identity.user_id, data, idempotency_key)


@app.get("/api/reportes/mios", response_model=ReportPage)
def mine(
    identity: Annotated[Actor, Depends(actor)],
    service: Annotated[Reports, Depends(reports)],
    limite: Annotated[int, Query(ge=1, le=100)] = 20,
    cursor: Annotated[str | None, Query(min_length=1, max_length=512)] = None,
):
    return service.mine(identity.user_id, limite, cursor)


AdminIdentity = Annotated[Actor, Depends(admin_actor)]
ReportId = Annotated[int, Path(gt=0, le=MAX_ID)]


@app.get("/api/admin/reportes", response_model=AdminReportPage)
def admin_queue(
    identity: AdminIdentity,
    service: Annotated[Reports, Depends(reports)],
    estado: ReportStatus | None = None,
    tipo: ReportType | None = None,
    limite: Annotated[int, Query(ge=1, le=100)] = 20,
    cursor: Annotated[str | None, Query(min_length=1, max_length=512)] = None,
):
    return service.admin_queue(identity.user_id, limite, cursor, estado, tipo)


@app.get("/api/admin/reportes/{id}", response_model=AdminReportDetail)
def report_detail(id: ReportId, identity: AdminIdentity, service: Annotated[Reports, Depends(reports)]):
    return service.detail(id)


@app.patch("/api/admin/reportes/{id}", response_model=AdminReportDetail)
def review_report(id: ReportId, data: ReviewInput, identity: AdminIdentity, service: Annotated[Reports, Depends(reports)]):
    return service.review(id, identity.user_id, data)
