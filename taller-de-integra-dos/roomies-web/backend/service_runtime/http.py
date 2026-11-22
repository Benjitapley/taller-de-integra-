"""Políticas HTTP sin consultas ni reglas de negocio."""
from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse

from .contracts import RuleViolation, DependencyUnavailable


class RequestLimits:
    def __init__(self,app): self.app=app

    async def __call__(self,scope,receive,send):
        if scope["type"]!="http" or scope["method"] not in {"POST","PUT","PATCH","DELETE"}:
            return await self.app(scope,receive,send)
        import asyncio
        body=bytearray()
        try:
            async with asyncio.timeout(15):
                while True:
                    message=await receive()
                    if message["type"]=="http.disconnect": return
                    chunk=message.get("body",b"")
                    if len(body)+len(chunk)>6*1024*1024:
                        return await JSONResponse({"detail":"Solicitud demasiado grande."},status_code=413)(scope,receive,send)
                    body.extend(chunk)
                    if not message.get("more_body"): break
        except TimeoutError:
            return await JSONResponse({"detail":"Tiempo de recepción agotado."},status_code=408)(scope,receive,send)
        delivered=False
        async def replay():
            nonlocal delivered
            if delivered: return await receive()
            delivered=True
            return {"type":"http.request","body":bytes(body),"more_body":False}
        await self.app(scope,replay,send)


def configure(app):
    app.add_middleware(RequestLimits)
    @app.middleware("http")
    async def private_responses(request, call_next):
        response = await call_next(request)
        response.headers["Cache-Control"] = "no-store"
        return response

    @app.exception_handler(RuleViolation)
    async def rule_error(request, error):
        return JSONResponse({"detail": error.message}, status_code=error.status)

    @app.exception_handler(DependencyUnavailable)
    async def dependency_error(request, error):
        return JSONResponse({"detail": "Dependencia local no disponible."}, status_code=503)

    @app.exception_handler(RequestValidationError)
    async def validation_error(request, error):
        return JSONResponse({"detail": [{"loc": list(e["loc"]), "msg": e["msg"], "type": e["type"]} for e in error.errors()]}, status_code=422)

    @app.exception_handler(Exception)
    async def internal_error(request, error):
        return JSONResponse({"detail": "No se pudo completar la operación."}, status_code=503,
                            headers={"Cache-Control": "no-store"})
