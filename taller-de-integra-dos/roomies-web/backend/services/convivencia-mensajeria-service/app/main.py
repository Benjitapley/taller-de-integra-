import asyncio
import base64
from contextlib import asynccontextmanager
import hmac
import os
import re
from typing import Annotated, Literal

import jwt
from uuid import UUID

from fastapi import Depends, FastAPI, Header, Path, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException

from backend.service_runtime.contracts import DependencyUnavailable
from backend.service_runtime.http import configure
from backend.service_runtime.security import confirmed_actor, access_token
from backend.service_runtime.reporting_security import verify_report_service
from app.models import ErrorResponse, Incorporation, Receipt, Rental, ServiceError, Conversation, ConversationPage, Message, MessageCreate, MessagePage, Expulsion, Task, TaskPage, TaskCreate, TaskAssign, TaskState, unavailable
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


def task_cursor(user_id: int, rental_id: int, state: str, task_id: int) -> str:
    raw = f"{user_id}.{rental_id}.{state}.{task_id}".encode("ascii")
    return base64.urlsafe_b64encode(raw).decode("ascii").rstrip("=")


def decode_task_cursor(value: str, user_id: int, rental_id: int, state: str) -> int:
    if not re.fullmatch(r"[A-Za-z0-9_-]{1,128}", value):
        raise ServiceError("INVALID_CURSOR", "Cursor inválido.", 422)
    try:
        raw = base64.urlsafe_b64decode(value + "=" * (-len(value) % 4)).decode("ascii")
        owner, rental, cursor_state, task_id = raw.split(".")
        if (owner != str(user_id) or rental != str(rental_id) or cursor_state != state or
                not task_id.isdigit() or int(task_id) < 1 or int(task_id) > 9223372036854775807):
            raise ValueError()
        return int(task_id)
    except (ValueError, UnicodeDecodeError):
        raise ServiceError("INVALID_CURSOR", "Cursor inválido.", 422) from None


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

    @application.post("/api/arriendos/{id}/expulsiones", responses=errors)
    def expel(data: Expulsion, id: Annotated[int, Path(gt=0, le=9223372036854775807)], identity=Depends(confirmed_actor), application_service=Depends(service)):
        return application_service.expel(id, identity.user_id, data.model_dump())

    @application.get("/api/arriendos/mio", response_model=Rental, responses=errors)
    def mine(identity=Depends(confirmed_actor), application_service=Depends(service)):
        return application_service.repository.mine(identity.user_id)

    @application.get("/api/arriendos/{id}", response_model=Rental, responses=errors)
    def detail(request: Request, id: Annotated[int, Path(gt=0, le=9223372036854775807)], identity=Depends(confirmed_actor), application_service=Depends(service)):
        try:
            return application_service.repository.get(id, identity.user_id)
        except ServiceError as error:
            if error.status != 404:
                raise
            publication = application_service.repository.rental_publication(id)
            if type(publication) is not int:
                raise error
            token = request.headers.get("authorization", "").partition(" ")[2]
            if application_service.publications.owned_by(publication, identity.user_id, token) is not True:
                raise ServiceError("FORBIDDEN", "No tienes acceso al arriendo.", 403)
            return application_service.repository.get(id, identity.user_id, owner=True)

    @application.get("/api/arriendos/{id}/integrantes")
    def members(id: Annotated[int, Path(gt=0, le=9223372036854775807)],
                limite: Annotated[int, Query(ge=1, le=100)] = 20,
                cursor: Annotated[str | None, Query(min_length=1, max_length=2048)] = None, identity=Depends(confirmed_actor),
                token=Depends(access_token), application_service=Depends(service)):
        secret = os.environ.get("ROOMIES_INTERNAL_TOKEN", "")
        if len(secret) < 32:
            raise unavailable()
        context = {"rental": id, "actor": identity.user_id, "limit": limite}
        after = 0
        if cursor is not None:
            try:
                value = jwt.decode(cursor, secret, algorithms=["HS256"])
                if any(value.get(k) != v for k, v in context.items()) or type(value.get("after")) is not int or not 0 < value["after"] <= 9223372036854775807:
                    raise ValueError()
                after = value["after"]
            except Exception:
                raise ServiceError("INVALID_CURSOR", "Cursor inválido.", 422) from None
        repository = application_service.repository
        publication = repository.rental_publication(id)
        # A resident does not depend on Listado to read their own membership.
        try:
            repository.get(id, identity.user_id)
            owner = False
        except ServiceError as error:
            if error.status != 404:
                raise
            owner = application_service.publications.owned_by(publication, identity.user_id, token)
        rows = repository.members(id, identity.user_id, owner, after, limite)
        next_cursor = jwt.encode({**context, "after": rows[limite-1]["id_pertenencia"]}, secret, algorithm="HS256") if len(rows) > limite else None
        return {"items": [{"id_usuario": row["id_usuario"], "nombre": None,
                  "fecha_ingreso": row["fecha_ingreso"], "activo": row["activo"],
                  "es_responsable": row["es_responsable"]} for row in rows[:limite]], "siguiente_cursor": next_cursor,
                "puede_retirar": owner is True}

    @application.get("/api/conversaciones", response_model=ConversationPage, responses=errors)
    def conversations(limite: Annotated[int, Query(ge=1, le=100)] = 20,
                      cursor: Annotated[str | None, Query(min_length=1, max_length=1024)] = None,
                      identity=Depends(confirmed_actor), application_service=Depends(service)):
        secret = os.environ.get("ROOMIES_INTERNAL_TOKEN", "")
        if len(secret) < 32:
            raise unavailable()
        context = {"kind": "conversations", "actor": identity.user_id, "limit": limite}
        after = 0
        if cursor is not None:
            try:
                value = jwt.decode(cursor, secret, algorithms=["HS256"])
                if any(value.get(k) != v for k, v in context.items()) or type(value.get("after")) is not int or not 0 < value["after"] <= 9223372036854775807:
                    raise ValueError()
                after = value["after"]
            except (jwt.PyJWTError, ValueError, TypeError):
                raise ServiceError("INVALID_CURSOR", "Cursor inválido.", 422) from None
        rows = application_service.repository.conversations(identity.user_id, after, limite)
        next_cursor = jwt.encode({**context, "after": rows[limite - 1]["id_conversacion"]}, secret, algorithm="HS256") if len(rows) > limite else None
        return {"items": rows[:limite], "siguiente_cursor": next_cursor}

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
            if not all(part.isdigit() and 0 < int(part) <= 9223372036854775807 for part in (owner, chat, message_id)):
                raise ValueError()
            if int(owner) != user_id or int(chat) != conversation_id:
                raise ValueError()
            return int(message_id)
        except (ValueError, UnicodeDecodeError):
            raise ServiceError("INVALID_CURSOR", "Cursor inválido.", 422) from None

    @application.get("/api/conversaciones/{id}/mensajes", response_model=MessagePage, responses=errors)
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

    @application.get("/api/arriendos/{id}/tareas", response_model=TaskPage, responses=errors)
    def tasks(
        id: Annotated[int, Path(gt=0, le=9223372036854775807)],
        estado: Literal["Pendiente", "Completada"] | None = None,
        id_asignado: Annotated[int | None, Query(gt=0, le=9223372036854775807)] = None,
        cursor: Annotated[str | None, Query(max_length=128)] = None,
        limite: Annotated[int, Query(ge=1, le=100)] = 20,
        identity=Depends(confirmed_actor), application_service=Depends(service),
    ):
        # Consultar la pertenencia incluso si el cursor es inválido.
        application_service.repository._active_member_check(id, identity.user_id)
        context = estado or "Todas"
        if id_asignado is not None:
            context += f":{id_asignado}"
        before = decode_task_cursor(cursor, identity.user_id, id, context) if cursor else None
        args = (id, identity.user_id, estado, before, limite)
        items, next_id = application_service.repository.list_tasks(*args, assigned=id_asignado) if id_asignado is not None else application_service.repository.list_tasks(*args)
        return {"items": items, "siguiente_cursor": task_cursor(identity.user_id, id, context, next_id) if next_id else None,
                "id_usuario_actual": identity.user_id}

    @application.post("/api/arriendos/{id}/tareas", response_model=Task, status_code=201, responses=errors)
    def create_task(data: TaskCreate, id: Annotated[int, Path(gt=0, le=9223372036854775807)],
                    identity=Depends(confirmed_actor), application_service=Depends(service)):
        return application_service.repository.create_task(id, identity.user_id, data.titulo, data.descripcion, data.id_asignado)

    @application.patch("/api/tareas/{id}", response_model=Task, responses=errors)
    def reassign_task(data: TaskAssign, id: Annotated[int, Path(gt=0, le=9223372036854775807)],
                      identity=Depends(confirmed_actor), application_service=Depends(service)):
        return application_service.repository.reassign_task(id, identity.user_id, data.id_asignado)

    @application.patch("/api/tareas/{id}/estado", response_model=Task, responses=errors)
    def complete_task(data: TaskState, id: Annotated[int, Path(gt=0, le=9223372036854775807)],
                      identity=Depends(confirmed_actor), application_service=Depends(service)):
        return application_service.repository.complete_task(id, identity.user_id)

    return application


app = create_app()
