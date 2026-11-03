import asyncio

import anyio
import httpx
from fastapi import Request
from starlette.responses import JSONResponse, Response


HOP_HEADERS = {b"connection", b"keep-alive", b"proxy-authenticate", b"proxy-authorization",
               b"te", b"trailer", b"transfer-encoding", b"upgrade", b"content-length"}
REQUEST_HEADERS = {b"authorization", b"content-type", b"content-encoding", b"accept", b"accept-language"}
RESPONSE_HEADERS = {b"content-type", b"content-language", b"www-authenticate", b"retry-after"}


def filtered(headers, allowed):
    blocked = set(HOP_HEADERS)
    for name, value in headers:
        if name.lower() == b"connection":
            blocked.update(part.strip().lower() for part in value.split(b","))
    return [(name.lower(), value) for name, value in headers
            if name.lower() in allowed and name.lower() not in blocked]


def unavailable(status):
    messages = {408: "Tiempo de recepción agotado.", 413: "Solicitud demasiado grande.",
                415: "Codificación de solicitud no admitida.",
                502: "Error de comunicación con el servicio.",
                503: "Servicio no configurado.", 504: "Tiempo de espera agotado."}
    return JSONResponse({"detail": messages[status]}, status_code=status)


class BodyTooLarge(Exception):
    pass


async def bounded_body(stream, limit):
    # Sin lista de fragmentos: longitud máxima limit y una copia al convertir
    # a bytes. bytearray puede reservar algo más; ASGI/HTTPX aporta su propio chunk.
    buffer = bytearray()
    async for chunk in stream:
        if len(chunk) > limit - len(buffer):
            raise BodyTooLarge()
        buffer.extend(chunk)
    return bytes(buffer)


async def forward(request: Request):
    settings = request.app.state.settings
    encodings = [value.strip().lower() for name, value in request.scope["headers"]
                 if name.lower() == b"content-encoding"]
    if encodings and encodings != [b"identity"]:
        return unavailable(415)
    if not settings.upstream:
        return unavailable(503)
    url = httpx.URL(settings.upstream).copy_with(
        path="/usuarios/me", query=request.scope["query_string"])
    headers = filtered(request.scope["headers"], REQUEST_HEADERS)
    # Solicitar identidad evita descompresión implícita; a la vuelta se leen bytes raw.
    headers.append((b"accept-encoding", b"identity"))
    receiving = True
    try:
        async with asyncio.timeout(settings.total_timeout):
            async with asyncio.timeout(settings.client_body_timeout):
                content = await bounded_body(request.stream(), settings.max_request_bytes)
            receiving = False
            client = request.app.state.client
            outgoing = client.build_request(request.method, url, headers=headers, content=content)
            outgoing.headers.pop("cookie", None)
            upstream = await client.send(outgoing, stream=True)
            client.cookies.clear()
            try:
                body = await bounded_body(upstream.aiter_raw(), settings.max_response_bytes)
                response = Response(content=body, status_code=upstream.status_code)
                response.raw_headers = filtered(upstream.headers.raw,
                                                RESPONSE_HEADERS | {b"content-encoding"})
                if ("content-encoding" in upstream.headers
                        and "content-encoding" not in response.headers):
                    # Connection no puede hacer que bytes codificados pierdan
                    # silenciosamente la cabecera necesaria para interpretarlos.
                    return unavailable(502)
                if upstream.status_code >= 200 and upstream.status_code not in {204, 304}:
                    response.headers["Content-Length"] = str(len(body))
                return response
            finally:
                # Cerrar también tras cancelación; margen de limpieza máximo 1 s.
                with anyio.move_on_after(1, shield=True):
                    await upstream.aclose()
    except BodyTooLarge:
        return unavailable(413 if receiving else 502)
    except TimeoutError:
        return unavailable(408 if receiving else 504)
    except httpx.TimeoutException:
        return unavailable(504)
    except httpx.RequestError:
        return unavailable(502)
