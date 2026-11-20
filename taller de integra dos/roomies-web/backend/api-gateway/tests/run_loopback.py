"""Integración TCP reproducible: python -I -B tests/run_loopback.py.

Dos procesos Uvicorn, sockets reservados en 127.0.0.1 y datos ficticios.
No importar desde pytest: ejecutar este script directamente.
"""
import asyncio
import argparse
import gzip
import http.client
import multiprocessing as mp
import os
from pathlib import Path
import queue
import socket
import sys
import threading
import time


ROOT = Path(__file__).resolve().parents[1]
TOKEN = "Bearer ficticio.scrum83.loopback"
QUERY = b"tag=a&tag=b&empty=&encoded=%2F%25&plus=a+b&unicode=%C3%B1"
PATCH_BODY = b'{ "nombre": "Persona ficticia", "ciudad": "Ciudad de prueba" }'
GET_BODY = b'{"nombre":"Perfil ficticio"}'
PATCH_REPLY = b'{"actualizado":true}'


class NetworkGuard:
    """Audita sockets Python; no es un firewall del sistema operativo."""

    def __init__(self, ports):
        self.ports = set(ports)
        self.blocked = []
        self.scope = threading.local()
        original_pair = socket.socketpair

        def pair(*args, **kwargs):
            self.scope.internal_pair = True
            try:
                return original_pair(*args, **kwargs)
            finally:
                self.scope.internal_pair = False

        socket.socketpair = pair
        sys.addaudithook(self.audit)

    def audit(self, event, args):
        if event not in {"socket.connect", "socket.getaddrinfo", "socket.sendto", "socket.bind"}:
            return
        if event == "socket.getaddrinfo":
            address = args[:2]
        else:
            address = args[-1]
        internal = getattr(self.scope, "internal_pair", False)
        allowed = (isinstance(address, tuple) and len(address) >= 2
                   and ((address[0] == "127.0.0.1" and address[1] in self.ports)
                        or (internal and address[0] in {"127.0.0.1", "::1"})))
        if event == "socket.sendto" or not allowed:
            self.blocked.append(event)
            raise RuntimeError("Operación de red fuera del loopback autorizado bloqueada.")


def clean_environment():
    keep = {key: value for key, value in os.environ.items()
            if key.upper() in {"SYSTEMROOT", "WINDIR", "TEMP", "TMP", "COMSPEC"}}
    os.environ.clear()
    os.environ.update(keep)
    sys.dont_write_bytecode = True


def serve(role, listener, auth_port, stop, reports):
    """Entrada de proceso independiente; no importa el backend central."""
    clean_environment()
    guard = NetworkGuard({auth_port} if role == "gateway" else set())
    # bind/listen ya se realizaron en el padre; solo el Gateway inicia conexiones.
    try:
        import uvicorn
        if role == "gateway":
            sys.path.insert(0, str(ROOT))
            from app.config import Settings
            from app.main import create_app
            app = create_app(Settings(upstream=f"http://127.0.0.1:{auth_port}",
                                      read_timeout=0.2, client_body_timeout=0.25,
                                      total_timeout=0.45, max_request_bytes=256,
                                      max_response_bytes=128))
        else:
            from fastapi import FastAPI, Request
            from starlette.responses import Response, StreamingResponse
            app = FastAPI(docs_url=None, redoc_url=None, openapi_url=None)

            @app.get("/health")
            async def health():
                return {"status": "ok"}

            async def profile(request: Request):
                body = await request.body()
                reports.put(("request", {"method": request.method,
                    "path": request.scope["raw_path"], "query": request.scope["query_string"],
                    "body": body, "authorization": request.headers.get("authorization"),
                    "content_type": request.headers.get("content-type")}))
                mode = request.query_params.get("mode")
                if mode in {"exact", "large", "trickle"}:
                    async def stream():
                        if mode == "trickle":
                            for _ in range(30):
                                await asyncio.sleep(0.05)
                                yield b"x"
                        else:
                            yield b"x" * 64
                            yield b"x" * 64
                            if mode == "large":
                                yield b"x"
                    return StreamingResponse(stream(), media_type="application/octet-stream")
                if mode == "compressed":
                    return Response(gzip.compress(GET_BODY), media_type="application/json",
                                    headers={"Content-Encoding": "gzip"})
                if mode == "timeout":
                    await asyncio.sleep(0.6)
                if mode == "unavailable":
                    return Response(b"Servicio ficticio no disponible", status_code=503,
                                    media_type="text/plain")
                return Response(GET_BODY if request.method == "GET" else PATCH_REPLY,
                                media_type="application/json")

            app.add_api_route("/usuarios/me", profile, methods=["GET", "PATCH"])

        server = uvicorn.Server(uvicorn.Config(app, access_log=False, log_level="critical",
                                               proxy_headers=False, timeout_graceful_shutdown=2))

        def watch_stop():
            stop.wait()
            server.should_exit = True

        threading.Thread(target=watch_stop, daemon=True).start()
        server.run(sockets=[listener])
    finally:
        listener.close()
        forbidden = [name for name in sys.modules if name == "backend" or name.startswith("backend.")
                     or name in {"psycopg", "supabase", "sqlalchemy", "jwt"}]
        reports.put(("finished", role, guard.blocked, forbidden))


def reserve_listener():
    listener = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        listener.bind(("127.0.0.1", 0))
        listener.listen(128)
        listener.setblocking(False)
        return listener
    except BaseException:
        listener.close()
        raise


def run(*, fail_after_start=False):
    clean_environment()
    import httpx
    context = mp.get_context("spawn")
    reports = context.Queue()
    stop = context.Event()
    listeners, processes, messages = [], [], []
    guard = None
    failure = None
    try:
        for _ in range(2):
            listeners.append(reserve_listener())
        auth_port, gateway_port = [item.getsockname()[1] for item in listeners]
        guard = NetworkGuard({auth_port, gateway_port})
        for role, listener in zip(("auth", "gateway"), listeners):
            process = context.Process(target=serve, args=(role, listener, auth_port, stop, reports),
                                      name=f"scrum83-loopback-{role}")
            process.start()
            processes.append(process)
        # Cada hijo recibe su propio descriptor: el padre deja de mantenerlos abiertos.
        for listener in listeners:
            listener.close()

        with httpx.Client(trust_env=False, timeout=3, follow_redirects=False) as client:
            for port in (auth_port, gateway_port):
                deadline = time.monotonic() + 15
                while True:
                    if any(process.exitcode is not None for process in processes):
                        raise AssertionError("Un servidor terminó antes de estar listo.")
                    try:
                        response = client.get(f"http://127.0.0.1:{port}/health")
                        if response.status_code == 200 and response.json() == {"status": "ok"}:
                            break
                    except httpx.TransportError:
                        pass
                    if time.monotonic() >= deadline:
                        raise AssertionError("Timeout al iniciar servidor local.")
                    time.sleep(0.05)

            if fail_after_start:
                raise RuntimeError("Fallo deliberado para comprobar limpieza de servidores.")

            base = f"http://127.0.0.1:{gateway_port}/usuarios/me"
            headers = {"Authorization": TOKEN}
            result = client.get(base + "?" + QUERY.decode(), headers=headers)
            assert result.status_code == 200 and result.content == GET_BODY
            assert result.headers["content-type"] == "application/json"
            assert result.headers["cache-control"] == "no-store"

            headers["Content-Type"] = "application/json"
            result = client.patch(base + "?" + QUERY.decode(), content=PATCH_BODY, headers=headers)
            assert result.status_code == 200 and result.content == PATCH_REPLY
            assert result.headers["content-type"] == "application/json"
            assert result.headers["cache-control"] == "no-store"

            result = client.patch(base + "?mode=unavailable", content=PATCH_BODY, headers=headers)
            assert result.status_code == 503 and result.content == b"Servicio ficticio no disponible"
            assert result.headers["content-type"].startswith("text/plain")
            assert result.headers["cache-control"] == "no-store"

            result = client.patch(base + "?mode=timeout", content=PATCH_BODY, headers=headers)
            assert result.status_code == 504
            assert result.json() == {"detail": "Tiempo de espera agotado."}
            assert result.headers["cache-control"] == "no-store"
            # Esperar más que la respuesta lenta para detectar duplicados tardíos.
            time.sleep(0.8)

            result = client.get(base, headers={"Authorization": TOKEN, "Host": "gateway.test/otro?x="})
            assert result.status_code == 200 and result.headers["cache-control"] == "no-store"
            result = client.get(base.replace("/me", "/%6de"),
                                headers={"Host": "gateway.test/otro?x="})
            assert result.status_code == 404 and result.headers["cache-control"] == "no-store"

            result = client.patch(base, content=gzip.compress(b"{}"),
                                  headers={**headers, "Content-Encoding": "gzip"})
            assert result.status_code == 415 and result.headers["cache-control"] == "no-store"
            result = client.patch(base, content=PATCH_BODY, headers={**headers, "Content-Encoding": "identity"})
            assert result.status_code == 200 and result.content == PATCH_REPLY

            # Generadores sin Content-Length: HTTPX envía Transfer-Encoding: chunked.
            result = client.patch(base, content=iter([b"x" * 128, b"x" * 128]), headers=headers)
            assert result.status_code == 200
            result = client.patch(base, content=iter([b"x" * 128, b"x" * 128, b"x"]), headers=headers)
            assert result.status_code == 413 and result.headers["cache-control"] == "no-store"
            result = client.get(base + "?mode=exact", headers=headers)
            assert result.status_code == 200 and result.content == b"x" * 128
            assert result.headers["content-length"] == "128"
            result = client.get(base + "?mode=large", headers=headers)
            assert result.status_code == 502
            assert result.json() == {"detail": "Error de comunicación con el servicio."}
            assert result.headers["cache-control"] == "no-store"
            result = client.patch(base + "?mode=trickle", content=PATCH_BODY, headers=headers)
            assert result.status_code == 504 and result.headers["cache-control"] == "no-store"

            with client.stream("GET", base + "?mode=compressed", headers=headers) as response:
                raw = b"".join(response.iter_raw())
                assert response.status_code == 200 and gzip.decompress(raw) == GET_BODY
                assert response.headers["content-encoding"] == "gzip"
                assert int(response.headers["content-length"]) == len(raw)

            # Cuerpo fragmentado continuo, más lento que el plazo global de recepción.
            with socket.create_connection(("127.0.0.1", gateway_port), timeout=3) as slow:
                slow.sendall(b"PATCH /usuarios/me HTTP/1.1\r\nHost: gateway.test\r\n"
                             b"Transfer-Encoding: chunked\r\nContent-Type: application/json\r\n\r\n")
                for _ in range(8):
                    slow.sendall(b"1\r\nx\r\n")
                    time.sleep(0.04)
                slow.sendall(b"0\r\n\r\n")
                received = http.client.HTTPResponse(slow)
                received.begin()
                assert received.status == 408
                assert received.getheader("Cache-Control") == "no-store"
                assert b"Tiempo de recepci" in received.read()
                received.close()
            time.sleep(0.6)
    except BaseException as error:
        failure = error
    finally:
        stop.set()
        for listener in listeners:
            listener.close()
        forced = []
        for process in processes:
            process.join(timeout=5)
            if process.is_alive():
                forced.append(process.name)
                process.terminate()
                process.join(timeout=5)
            if process.is_alive():
                process.kill()
                process.join(timeout=5)
        # Con procesos terminados, los feeders de Queue ya enviaron sus reportes.
        while True:
            try:
                messages.append(reports.get(timeout=0.2))
            except queue.Empty:
                break
        reports.close()
        reports.join_thread()
        exitcodes = [process.exitcode for process in processes]
        alive = [process.name for process in processes if process.is_alive()]
        for process in processes:
            if not process.is_alive():
                process.close()
        print(f"Limpieza: {len(processes)} procesos; activos={len(alive)}; cierres forzados={len(forced)}")

    if failure is not None:
        raise failure
    assert not alive and not forced and exitcodes == [0, 0], "Cierre anormal de servidores"
    requests = [message[1] for message in messages if message[0] == "request"]
    assert len(requests) == 11, "Cantidad inesperada de llamadas: posible reintento"
    assert [item["method"] for item in requests[:4]] == ["GET", "PATCH", "PATCH", "PATCH"]
    for index, item in enumerate(requests):
        assert item["path"] == b"/usuarios/me"
        assert item["authorization"] == TOKEN
        if index < 4:
            assert item["body"] == (b"" if index == 0 else PATCH_BODY)
        if item["method"] == "PATCH":
            assert item["content_type"] == "application/json"
    assert [item["query"] for item in requests] == [QUERY, QUERY, b"mode=unavailable", b"mode=timeout",
        b"", b"", b"", b"mode=exact", b"mode=large", b"mode=trickle", b"mode=compressed"]
    assert requests[5]["body"] == PATCH_BODY
    assert requests[6]["body"] == b"x" * 256
    assert requests[9]["method"] == "PATCH" and requests[9]["body"] == PATCH_BODY
    finished = [message for message in messages if message[0] == "finished"]
    assert len(finished) == 2
    assert guard is not None and not guard.blocked
    assert all(not message[2] and not message[3] for message in finished)
    print("APROBADO: GET 200, PATCH 200, PATCH 503 y PATCH 504 por HTTP TCP real.")
    print("APROBADO: Bearer ficticio, rutas, query raw, JSON, respuestas y no-store.")
    print("APROBADO: 11 llamadas exactas al simulado; cada PATCH aceptado llegó una vez.")
    print("APROBADO: límites exactos/fragmentados, 413/502, Host malformado y 415/identity.")
    print("APROBADO: recepción lenta 408, flujo upstream continuo 504 y gzip/Content-Length coherentes.")
    print("APROBADO: sin intentos de red fuera de loopback ni imports de servicios reales.")


if __name__ == "__main__":
    mp.freeze_support()
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fail-after-start", action="store_true",
                        help="Provocar un fallo tras iniciar servidores; debe salir con código 1.")
    run(fail_after_start=parser.parse_args().fail_after_start)
