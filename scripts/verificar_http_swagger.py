"""Comprueba HTTP local y recursos de Swagger sin iniciar ni conectar PostgreSQL."""

import json
import re
import socket
import sys
import threading
import time
from pathlib import Path
from unittest.mock import patch

import httpx
import uvicorn

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts"))
from verificar_swagger_publicaciones import cargar_aplicacion


def verify():
    cases = []
    documents = []
    with patch("dotenv.load_dotenv", return_value=False), \
            patch("psycopg.connect", side_effect=AssertionError("PostgreSQL bloqueado en smoke HTTP")) as connect:
        api = cargar_aplicacion()
        sock = socket.socket()
        sock.bind(("127.0.0.1", 0))
        port = sock.getsockname()[1]
        server = uvicorn.Server(uvicorn.Config(api.app, lifespan="off", access_log=False, log_level="error"))
        thread = threading.Thread(target=server.run, kwargs={"sockets": [sock]}, daemon=True)
        thread.start()
        try:
            for _ in range(100):
                if server.started or not thread.is_alive():
                    break
                time.sleep(0.05)
            if not server.started:
                raise RuntimeError("El servidor HTTP temporal no inició")
            with httpx.Client(base_url=f"http://127.0.0.1:{port}", timeout=5) as client:
                for route, marker in (("/docs", "SwaggerUIBundle"), ("/redoc", "<redoc"),
                                      ("/openapi.json", '"openapi"'),
                                      ("/docs/oauth2-redirect", "swaggerUIRedirectOauth2"),
                                      ("/inicio", 'id="form-busqueda"'),
                                      ("/crear", 'id="form-crear"'),
                                      ("/static_principal/HayCupo.js", "consultarCuposDetalle"),
                                      ("/static_principal/tailwind.css", "tailwindcss")):
                    response = client.get(route)
                    ok = response.status_code == 200 and marker in response.text
                    cases.append({"grupo": "HTTP local", "ruta": route, "esperado": "200 y contenido correcto",
                                  "obtenido": response.status_code, "contenido_correcto": marker in response.text,
                                  "resultado": "PASS" if ok else "FAIL"})
                    if route in ("/docs", "/redoc"):
                        documents.append(response.text)
        finally:
            server.should_exit = True
            thread.join(timeout=5)
            sock.close()
            if thread.is_alive():
                raise RuntimeError("El servidor temporal no se detuvo")
        assert connect.call_count == 0

    urls = sorted({url for html in documents for url in re.findall(r'(?:src|href)="(https:[^"]+)"', html)
                   if url.startswith("https://cdn.jsdelivr.net/")})
    for url in urls:
        try:
            with httpx.stream("GET", url, timeout=7, follow_redirects=True) as response:
                first = next(response.iter_bytes(chunk_size=64), b"")
                status = response.status_code
                ok = status == 200 and bool(first)
                cases.append({"grupo": "CDN externo", "ruta": url, "esperado": "200 y datos",
                              "obtenido": status, "resultado": "PASS" if ok else "FAIL"})
        except httpx.HTTPError as error:
            cases.append({"grupo": "CDN externo", "ruta": url, "esperado": "200 y datos",
                          "obtenido": type(error).__name__, "resultado": "NO_VALIDADO"})
    return {"alcance": "HTTP TCP real sobre loopback; aplicación real con conexiones aisladas y lifespan desactivado",
            "limites": "No navegador ni persistencia; los CDN se consultan sin ejecutar JavaScript",
            "puerto_temporal": port, "servidor_detenido": True, "intentos_postgresql": 0,
            "totales": {"casos": len(cases), "pass": sum(c["resultado"] == "PASS" for c in cases),
                        "fail": sum(c["resultado"] == "FAIL" for c in cases),
                        "no_validado": sum(c["resultado"] == "NO_VALIDADO" for c in cases)},
            "casos": cases}


def main():
    result = verify()
    target = ROOT / "output/qa/http_swagger.json"
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(result["totales"]))
    return 1 if result["totales"]["fail"] or result["totales"]["no_validado"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
