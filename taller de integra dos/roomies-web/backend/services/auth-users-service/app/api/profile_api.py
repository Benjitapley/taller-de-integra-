"""Opt-in registration and HTTP policies for the provisional profile API."""

from typing import Any, Callable

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from app.api.routes.profiles import router as profiles_router


def _is_private_profile_path(path: str) -> bool:
    return path == "/usuarios" or path.startswith("/usuarios/")


class ProfileNoStoreMiddleware:
    """Adds no-store to profile replies and sanitizes unexpected route errors."""

    def __init__(self, app: Callable[..., Any]) -> None:
        self.app = app

    async def __call__(self, scope, receive, send) -> None:
        if scope.get("type") != "http" or not _is_private_profile_path(scope.get("path", "")):
            await self.app(scope, receive, send)
            return

        response_started = False

        async def send_no_store(message) -> None:
            nonlocal response_started
            if message["type"] == "http.response.start":
                response_started = True
                headers = [
                    (name, value)
                    for name, value in message.get("headers", [])
                    if name.lower() != b"cache-control"
                ]
                headers.append((b"cache-control", b"no-store"))
                message = {**message, "headers": headers}
            await send(message)

        try:
            await self.app(scope, receive, send_no_store)
        except Exception:
            if response_started:
                raise
            response = JSONResponse(
                status_code=500,
                content={"detail": "Error interno."},
                headers={"Cache-Control": "no-store"},
            )
            await response(scope, receive, send)


async def sanitized_validation_error(
    request: Request, error: RequestValidationError
) -> JSONResponse:
    """Omit Pydantic's raw input/context from validation responses."""

    return JSONResponse(
        status_code=422,
        content={
            "detail": [
                {
                    "loc": list(item.get("loc", ())),
                    "msg": item.get("msg", "Valor no válido."),
                    "type": item.get("type", "value_error"),
                }
                for item in error.errors()
            ]
        },
    )


def register_profile_routes(app: FastAPI) -> None:
    """Opt in to the provisional API; production must supply a real repository."""

    app.add_middleware(ProfileNoStoreMiddleware)
    app.add_exception_handler(RequestValidationError, sanitized_validation_error)
    app.include_router(profiles_router)
