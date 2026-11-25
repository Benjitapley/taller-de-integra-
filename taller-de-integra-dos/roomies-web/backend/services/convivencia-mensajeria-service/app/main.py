import asyncio
import base64
from contextlib import asynccontextmanager
import hmac
import json
import os
import re
from typing import Annotated
from uuid import UUID

from fastapi import Depends, FastAPI, Header, Path, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from backend.service_runtime.contracts import DependencyUnavailable
from backend.service_runtime.http import configure
from backend.service_runtime.security import confirmed_actor
from backend.service_runtime.reporting_security import verify_report_service
from app.models import ErrorResponse, Incorporation, Receipt, Rental, ServiceError, Conversation, Message, MessageCreate, MessagePage, unavailable
from app.ports import HttpIdentity, HttpPublications
from app.repository import PostgresRepository
from app.service import Convivencia
from app.models import ExpulsionCreate, ExpulsionResult, Task, TaskPage, TaskCreate, TaskAssignment, TaskState
from app import departures


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
        return {"status": "ok", "scope": "incorporacion-mensajeria-v1"}

    @application.get("/internal/convivencia/relacion")
    def rental_relationship(
        a: Annotated[int, Query(gt=0, le=9223372036854775807)],
        b: Annotated[int, Query(gt=0, le=9223372036854775807)],
        application_service=Depends(service),
        authorization: Annotated[str | None, Header()] = None,
    ):
        verify_report_service(authorization, "convivencia-mensajeria", "REPORTES_CONVIVENCIA_JWT_KEY")
        return {"coincidio": application_service.repository.overlapped(a, b)}

    errors = {status: {"model": ErrorResponse} for status in (401, 403, 404, 409, 422, 503)}

    @application.post("/internal/incorporaciones", dependencies=[Depends(internal_service)], status_code=201, response_model=Receipt, responses=errors)
    def incorporate(data: Incorporation, idempotency_key: Annotated[UUID, Header()], application_service=Depends(service)):
        status, body, replay = application_service.incorporate(idempotency_key, data.model_dump())
        return JSONResponse(body, status_code=status, headers={"Idempotency-Replayed": str(replay).lower()})

    @application.get("/api/arriendos/mio", response_model=Rental, responses=errors)
    def mine(identity=Depends(confirmed_actor), application_service=Depends(service)):
        return {**application_service.repository.mine(identity.user_id), 'id_usuario_actual': identity.user_id}

    @application.get("/api/arriendos/{id}", response_model=Rental, responses=errors)
    def detail(id: Annotated[int, Path(gt=0, le=9223372036854775807)], identity=Depends(confirmed_actor), application_service=Depends(service)):
        return departures.detail(application_service, id, identity.user_id)

    @application.post('/api/arriendos/{id}/expulsiones', response_model=ExpulsionResult, responses=errors)
    def withdraw(id: Annotated[int, Path(gt=0, le=9223372036854775807)], data: ExpulsionCreate, identity=Depends(confirmed_actor), application_service=Depends(service)):
        return departures.withdraw(application_service, id, identity.user_id, data)

    def page_cursor(cursor, scope):
        if cursor is None:
            return 0
        try:
            if not re.fullmatch(r'[A-Za-z0-9_-]{1,2048}', cursor):
                raise ValueError()
            context, last = json.loads(base64.urlsafe_b64decode(cursor + '=' * (-len(cursor) % 4)))
            if context != scope or type(last) is not int or not 0 < last <= 9223372036854775807:
                raise ValueError()
            return last
        except (ValueError, TypeError, UnicodeError):
            raise ServiceError('INVALID_CURSOR', 'Cursor inválido para esta consulta.', 422) from None

    def page(rows, limit, scope, key):
        items = rows[:limit]
        cursor = base64.urlsafe_b64encode(json.dumps([scope, items[-1][key]]).encode()).decode().rstrip('=') if len(rows) > limit else None
        return {'items': items, 'siguiente_cursor': cursor}

    @application.get('/api/arriendos/{id}/integrantes', responses=errors)
    def members(id: Annotated[int, Path(gt=0, le=9223372036854775807)], cursor: str | None = None, activos: bool = True,
                limite: Annotated[int, Query(ge=1, le=100)] = 20,
                identity=Depends(confirmed_actor), application_service=Depends(service)):
        departures.detail(application_service, id, identity.user_id)
        scope = [identity.user_id, id, 'integrantes', activos]
        rows = application_service.repository.members(id, page_cursor(cursor, scope), limite + 1, activos)
        return page(rows, limite, scope, 'id_pertenencia')

    @application.get('/api/arriendos/{id}/tareas', response_model=TaskPage, responses=errors)
    def tasks(id: Annotated[int, Path(gt=0, le=9223372036854775807)], cursor: str | None = None,
              estado: Annotated[str | None, Query(pattern='^(Pendiente|Completada)$')] = None,
              id_asignado: Annotated[int | None, Query(gt=0)] = None,
              limite: Annotated[int, Query(ge=1, le=100)] = 20,
              identity=Depends(confirmed_actor), application_service=Depends(service)):
        with application_service.repository.transaction() as c:
            application_service.repository.active_member(c, id, identity.user_id)
        scope = [identity.user_id, id, 'tareas', estado, id_asignado]
        rows = application_service.repository.task_list(id, identity.user_id, page_cursor(cursor, scope), limite + 1, estado, id_asignado)
        return page(rows, limite, scope, 'id_tarea')

    @application.post('/api/arriendos/{id}/tareas', status_code=201, response_model=Task, responses=errors)
    def create_task(id: Annotated[int, Path(gt=0, le=9223372036854775807)], data: TaskCreate, identity=Depends(confirmed_actor), application_service=Depends(service)):
        return application_service.repository.create_task(id, identity.user_id, data.model_dump())

    @application.patch('/api/tareas/{id}', response_model=Task, responses=errors)
    def assign_task(id: Annotated[int, Path(gt=0, le=9223372036854775807)], data: TaskAssignment, identity=Depends(confirmed_actor), application_service=Depends(service)):
        return application_service.repository.update_task(id, identity.user_id, data.model_dump())

    @application.patch('/api/tareas/{id}/estado', response_model=Task, responses=errors)
    def complete_task(id: Annotated[int, Path(gt=0, le=9223372036854775807)], data: TaskState, identity=Depends(confirmed_actor), application_service=Depends(service)):
        return application_service.repository.update_task(id, identity.user_id, data.model_dump(), complete=True)

    @application.get("/api/conversaciones", responses=errors)
    def conversations(identity=Depends(confirmed_actor), application_service=Depends(service)):
        return {"items": application_service.repository.conversations(identity.user_id)}

    @application.get("/api/conversaciones/{id}", response_model=Conversation, responses=errors)
    def conversation(id: Annotated[int, Path(gt=0, le=9223372036854775807)], identity=Depends(confirmed_actor), application_service=Depends(service)):
        return application_service.repository.conversation(id, identity.user_id)

    def cursor_for(user_id, conversation_id, message_id):
        raw = f"{user_id}.{conversation_id}.{message_id}".encode("ascii")
        return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")

    def decode_cursor(value, user_id, conversation_id):
        if not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", value):
            raise ServiceError("INVALID_CURSOR", "Cursor inválido.", 422)
        try:
            raw = base64.urlsafe_b64decode(value + "=" * (-len(value) % 4)).decode("ascii")
            owner, chat, message_id = raw.split(".")
            if not all(part.isdigit() and int(part) > 0 for part in (owner, chat, message_id)):
                raise ValueError()
            if int(owner) != user_id or int(chat) != conversation_id:
                raise ValueError()
            return int(message_id)
        except (ValueError, UnicodeDecodeError):
            raise ServiceError("INVALID_CURSOR", "Cursor inválido.", 422) from None

    @application.get("/api/conversaciones/{id}/mensajes", response_model=MessagePage, response_model_exclude_none=True, responses=errors)
    def messages(
        id: Annotated[int, Path(gt=0, le=9223372036854775807)],
        antes: Annotated[str | None, Query(max_length=512)] = None,
        limite: Annotated[int, Query(ge=1, le=100)] = 20,
        identity=Depends(confirmed_actor), application_service=Depends(service),
    ):
        # Verify membership before validating actor-bound cursors.
        application_service.repository.conversation(id, identity.user_id)
        before_id = decode_cursor(antes, identity.user_id, id) if antes is not None else None
        page, next_before = application_service.repository.messages(id, identity.user_id, before_id, limite)
        items = []
        for row in page:
            item = dict(row)
            if item["id_remitente"] != identity.user_id:
                item.pop("id_cliente", None)
            items.append(item)
        next_cursor = cursor_for(identity.user_id, id, next_before) if next_before is not None else None
        return {"items": items, "siguiente_cursor": next_cursor}

    @application.post("/api/conversaciones/{id}/mensajes", response_model=Message, responses=errors)
    def send_message(
        data: MessageCreate,
        id: Annotated[int, Path(gt=0, le=9223372036854775807)],
        identity=Depends(confirmed_actor), application_service=Depends(service),
    ):
        return application_service.repository.send_message(
            id, identity.user_id, identity.display_name or f"Integrante #{identity.user_id}", data.contenido, data.id_cliente,
        )

    return application


app = create_app()
