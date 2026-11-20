from typing import Annotated

from fastapi import Depends, FastAPI, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException

from backend.service_runtime.contracts import Actor, DependencyUnavailable, RuleViolation
from backend.service_runtime.http import configure
from backend.service_runtime.security import actor, confirmed_actor
from app.models import Report, ReportInput, ReportPage
from app.relationships import Relationships
from app.repository import ReportRepository
from app.service import Reports


app = FastAPI(title="Roomies Reportes")
configure(app)
ERRORS = {401: "NO_AUTENTICADO", 403: "PROHIBIDO", 404: "NO_ENCONTRADO", 422: "SOLICITUD_INVALIDA", 503: "DEPENDENCIA_NO_DISPONIBLE"}


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
def create(data: ReportInput, identity: Annotated[Actor, Depends(confirmed_actor)], service: Annotated[Reports, Depends(reports)]):
    return service.create(identity.user_id, data)


@app.get("/api/reportes/mios", response_model=ReportPage)
def mine(
    identity: Annotated[Actor, Depends(actor)],
    service: Annotated[Reports, Depends(reports)],
    limite: Annotated[int, Query(ge=1, le=100)] = 20,
    cursor: Annotated[str | None, Query(min_length=1, max_length=512)] = None,
):
    return service.mine(identity.user_id, limite, cursor)
