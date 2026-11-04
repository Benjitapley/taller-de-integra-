"""Next.js real con proveedor de contrato ficticio y servicios/SQL reales locales."""
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import httpx

ROOT = Path(__file__).resolve().parents[2]
FRONT = ROOT / "frontend-next"


def run_web(fixture, common, identity, gateway, processes):
    node = Path(sys._base_executable).resolve().parent.parent / "node/bin/node.exe"
    playwright = node.parent.parent / "node_modules/playwright"
    # El runtime instala node_modules dentro de dependencies/node.
    if not playwright.exists(): playwright = node.parent / "node_modules/playwright"
    browser = Path("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe")
    if not node.is_file() or not playwright.is_dir() or not browser.is_file():
        raise RuntimeError("Faltan Node, Playwright o Edge locales para --web")
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0)); port = sock.getsockname()[1]
    origin = f"http://127.0.0.1:{port}"
    application = Path(tempfile.mkdtemp(prefix=".proxy-test-sprint2-", dir=FRONT)).resolve()
    link = application / "node_modules"
    log = open(fixture / "next.log", "w+b")
    process = None
    try:
        for name in ("next.config.ts", "package.json", "tsconfig.json", "src", "public"):
            source = FRONT / name
            if source.is_dir(): shutil.copytree(source, application / name)
            else: shutil.copy2(source, application / name)
        subprocess.run(["cmd", "/c", "mklink", "/J", str(link), str(FRONT / "node_modules")], check=True, stdout=subprocess.DEVNULL, creationflags=subprocess.CREATE_NO_WINDOW)
        env = {**common, "WEB_AUTH_ENABLED": "true", "WEB_AUTH_PROVIDER": "supabase", "WEB_AUTH_ORIGIN": origin,
               "WEB_AUTH_FASTAPI_ORIGIN": gateway, "FASTAPI_ORIGIN": gateway, "WEB_SUPABASE_ORIGIN": identity.origin,
               "WEB_SUPABASE_PUBLISHABLE_KEY": identity.publishable_key, "NEXT_TELEMETRY_DISABLED": "1",
               "NODE_OPTIONS": f"--require={ROOT / 'tests/e2e/network-guard.cjs'}"}
        process = subprocess.Popen([str(node), str(FRONT / "node_modules/next/dist/bin/next"), "dev", "--hostname", "127.0.0.1", "--port", str(port)], cwd=application, env=env, stdout=log, stderr=log, creationflags=subprocess.CREATE_NO_WINDOW)
        processes.append(process)
        with httpx.Client(base_url=origin, timeout=60, trust_env=False, follow_redirects=False) as client:
            for _ in range(180):
                if process.poll() is not None: raise AssertionError("Next.js no inició")
                try:
                    if client.get("/").status_code == 200: break
                except httpx.HTTPError: pass
                time.sleep(.2)
            else: raise AssertionError("Next.js no disponible")
            count = 0
            def auth(action, body, status=200, csrf=True):
                nonlocal count
                headers = {"Origin": origin, "X-Haycupo-CSRF": "1"} if csrf else {}
                response = client.post("/web-api/auth/" + action, json=body, headers=headers)
                assert response.status_code == status, (action, response.status_code, response.text[:250])
                assert "access_token" not in response.text and "refresh_token" not in response.text
                count += 1
                return response
            body = {"nombre": "Persona BFF", "correo": "webfiction@example.com", "contrasena": "Fictional-pass-123", "fecha_nacimiento": "2000-01-01"}
            auth("registro", body, 403, csrf=False)
            auth("registro", {**body, "admin": True}, 422)
            auth("registro", body)
            auth("verificar", {"correo": body["correo"], "codigo": identity.users[body["correo"]]["otp"]})
            assert not any("sb_" in cookie.name for cookie in client.cookies.jar)
            auth("login", {"correo": body["correo"], "contrasena": body["contrasena"]})
            for name in ("roomies_sb_dev_access", "roomies_sb_dev_refresh"):
                assert any(cookie.name == name and "HttpOnly" in cookie._rest for cookie in client.cookies.jar)
            assert client.get("/web-api/auth/sesion").json()["authenticated"]
            profile = client.get("/web-api/perfil")
            assert profile.status_code == 200, profile.text
            edited = client.put("/web-api/perfil", files={key: (None, value) for key, value in {"edad": str(profile.json()["edad"]), "ocupacion": "Diseño", "ciudad": "Temuco", "breve_descripcion": "Prueba", "sobre_mi": "Ficticio"}.items()}, headers={"Origin": origin, "X-Haycupo-CSRF": "1"})
            assert edited.status_code == 200, edited.text
            assert client.get("/web-api/perfil").json()["ciudad"] == "Temuco"
            csrf = {"Origin": origin, "X-Haycupo-CSRF": "1"}
            with httpx.Client(base_url=origin, timeout=60, trust_env=False) as owner:
                response = owner.post("/web-api/auth/login", json={"correo": "local0@example.com", "contrasena": "Fictional-pass-123"}, headers=csrf)
                assert response.status_code == 200
                publication = {"titulo": "Habitación BFF local", "descripcion": "Publicación ficticia", "ubicacion": "Temuco", "precio": "200000", "tipo": "Arrendador", "categoria": "ofrezco", "tipo_vivienda": "habitacion", "mascota": "no", "cupos_totales": "2", "permitir_comentarios": "false"}
                response = owner.post("/web-api/publicaciones", files={key: (None, value) for key, value in publication.items()}, headers=csrf)
                assert response.status_code == 201, response.text
                pub = response.json()["id"]
                response = client.post("/web-api/postulaciones", json={"publicacion": pub}, headers=csrf)
                assert response.status_code == 201, response.text
                application_id = response.json()["id_postulacion"]
                assert client.get(f"/web-api/postulaciones?publicacion={pub}").status_code == 404
                assert owner.get(f"/web-api/postulaciones?publicacion={pub}").status_code == 200
                for state in ("Preseleccionada", "Aceptada"):
                    response = owner.patch("/web-api/postulaciones", json={"id": application_id, "estado": state}, headers=csrf)
                    assert response.status_code == 200, response.text
                assert client.get("/web-api/postulaciones").json()[0]["estado"] == "Aceptada"
                assert owner.get("/web-api/admin").status_code == 200
                assert client.get("/web-api/admin").status_code == 403
                count += 9
            old_refresh = client.cookies.get("roomies_sb_dev_refresh")
            auth("renovar", {})
            assert old_refresh != client.cookies.get("roomies_sb_dev_refresh")
            # Access ausente con refresh válido: recuperación POST desde la página.
            client.cookies.delete("roomies_sb_dev_access")
            browser_cookies = fixture / "browser-cookies.json"
            browser_env = {**env, "ROOMIES_BROWSER": str(browser), "ROOMIES_PLAYWRIGHT": str(playwright), "ROOMIES_WEB": origin, "ROOMIES_BROWSER_COOKIES": str(browser_cookies)}
            with tempfile.TemporaryFile() as browser_log:
                result = subprocess.run([str(node), str(ROOT / "backend/local_stack/web_browser.mjs")], input=json.dumps({"cookies": [{"name": c.name, "value": c.value, "url": origin, "httpOnly": True, "sameSite": "Strict"} for c in client.cookies.jar]}).encode(), env=browser_env, stdout=browser_log, stderr=browser_log, timeout=120, creationflags=subprocess.CREATE_NO_WINDOW)
                browser_log.seek(0)
                output = browser_log.read().decode(errors="replace")
                if result.returncode: raise AssertionError(output[-3500:])
                print(output, flush=True)
            for cookie in json.loads(browser_cookies.read_text(encoding="utf-8")):
                assert cookie["domain"] == "127.0.0.1" and cookie["path"] == "/"
                client.cookies.set(cookie["name"], cookie["value"], domain="127.0.0.1", path="/")
            browser_cookies.unlink()
            previous = client.cookies.get("roomies_sb_dev_access")
            auth("logout", {})
            assert client.get("/web-api/auth/sesion").status_code == 401
            response = httpx.get(gateway + "/local/v1/perfil", headers={"Authorization": "Bearer " + previous}, trust_env=False)
            assert response.status_code == 401
            print(f"PASS Next.js BFF real: {count} operaciones Auth, cookies HttpOnly, perfil y revocación backend; proveedor ficticio, no GoTrue real", flush=True)
    except Exception:
        log.flush(); log.seek(0)
        print(log.read().decode(errors="replace")[-5000:], flush=True)
        raise
    finally:
        if process is not None and process.poll() is None:
            subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=subprocess.CREATE_NO_WINDOW)
            process.wait(timeout=15)
        log.close()
        assert application.parent == FRONT.resolve() and application.name.startswith(".proxy-test-sprint2-")
        if link.exists(): os.rmdir(link)  # Solo elimina la junction propia.
        def missing_only(function, path, error):
            if not isinstance(error, FileNotFoundError): raise error
        shutil.rmtree(application, onexc=missing_only)
