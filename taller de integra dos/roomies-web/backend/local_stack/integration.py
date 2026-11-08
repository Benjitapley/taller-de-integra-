"""Pruebas reales de cuatro procesos HTTP y tres roles SQL desechables."""
import json
import socket
import subprocess
import sys
import time
from pathlib import Path
from urllib.parse import urlsplit

import httpx
from testing_identity import IdentityFixture

ROOT = Path(__file__).resolve().parents[2]


def run_integration(fixture, urls, clean, processes, web=False, baseline=None, progressive=False):
    baseline = baseline or {"usuarios":0,"publicaciones":0,"conexiones":0}
    checks = 0
    logs = []
    def port():
        with socket.socket() as sock:
            sock.bind(("127.0.0.1", 0))
            return sock.getsockname()[1]

    with IdentityFixture() as identity, httpx.Client(timeout=15, trust_env=False, follow_redirects=False) as client:
        def provider(path, data):
            return client.post(identity.origin + "/auth/v1" + path, json=data, headers={"apikey": identity.publishable_key})

        people = []
        for index in range(3):
            email = f"local{index}@example.com"
            response = provider("/signup", {"email": email, "password": "Fictional-pass-123", "data": {"nombre": f"Persona local {index}", "fecha_nacimiento": "2000-03-01"}})
            assert response.status_code == 200
            response = provider("/verify", {"email": email, "token": identity.users[email]["otp"], "type": "email"})
            assert response.status_code == 200
            people.append(response.json())
        ports = {name: port() for name in ("auth", "listado", "match", "gateway")}
        origins = {name: f"http://127.0.0.1:{number}" for name, number in ports.items()}
        common = {**clean, "ROOMIES_LOCAL_MODE": "1", "ROOMIES_TEST_RUNNER": "disposable-only",
                  "ROOMIES_AUTH_PROVIDER_URL": identity.origin, "ROOMIES_AUTH_PUBLISHABLE_KEY": identity.publishable_key,
                  "SUPABASE_URL": identity.origin, "SUPABASE_JWT_AUDIENCE": "authenticated", "SUPABASE_JWT_ALGORITHMS": "ES256",
                  "AUTH_USERS_UPSTREAM_URL": origins["auth"], "LISTADO_UPSTREAM_URL": origins["listado"], "MATCH_UPSTREAM_URL": origins["match"],
                  "ROOMIES_INTERNAL_TOKEN": "disposable-" + "a" * 40,
                  "ROOMIES_ADMIN_SUBJECTS": people[0]["user"]["id"],
                  "ROOMIES_ALLOWED_PORTS": json.dumps([*ports.values(), urlsplit(identity.origin).port, urlsplit(urls["auth"]).port])}
        variables = {"auth": "AUTH_USERS_DATABASE_URL", "listado": "LISTADO_DATABASE_URL", "match": "MATCH_DATABASE_URL"}
        if progressive: common["ROOMIES_PERSISTENCE_LAYOUT"] = "haycupo-v1"
        try:
            for service in ports:
                env = {**common, "ROOMIES_PORT": str(ports[service]), "ROOMIES_IMAGE_DIR": str(fixture / (service + "-images"))}
                if service in variables: env[variables[service]] = urls[service]
                log = open(fixture / (service + ".log"), "w+b")
                logs.append(log)
                process = subprocess.Popen([sys.executable, "-I", "-B", str(ROOT / "backend/local_stack/serve.py"), service], env=env, stdout=log, stderr=log, creationflags=subprocess.CREATE_NO_WINDOW)
                processes.append(process)
                for _ in range(120):
                    if process.poll() is not None: raise AssertionError(f"No inició {service}")
                    try:
                        if client.get(origins[service] + "/health").status_code == 200: break
                    except httpx.HTTPError: pass
                    time.sleep(.1)
                else: raise AssertionError(f"Timeout iniciando {service}")

            def request(method, path, status=200, person=0, **kwargs):
                nonlocal checks
                headers = {"Authorization": "Bearer " + people[person]["access_token"]} if person is not None else {}
                response = client.request(method, origins["gateway"] + path, headers=headers, **kwargs)
                assert response.status_code == status, f"{method} {path}: {response.status_code}, esperado {status}: {response.text[:300]}"
                checks += 1
                return response.json() if response.content else None

            business_ids = []
            for index in range(3):
                result = request("POST", "/local/v1/perfil/inicializacion", person=index, json={"nombre": f"Persona local {index}", "fecha_nacimiento": "2000-03-01"})
                business_ids.append(result["id_usuario"])
                assert request("GET", "/local/v1/perfil", person=index)["edad_calculada"]
            request("GET", "/local/v1/perfil", person=None, status=401)
            request("POST", "/local/v1/perfil/inicializacion", status=422, json={"nombre": "Intruso", "fecha_nacimiento": "2000-01-01", "admin": True})
            request("PUT", "/local/v1/perfil", data={"ocupacion": "Estudiante", "ciudad": "Valdivia", "edad": "99"}, status=422)
            request("PUT", "/local/v1/perfil", data={"ocupacion": "Estudiante", "ciudad": "Valdivia"})
            assert request("GET", "/local/v1/perfil")["ciudad"] == "Valdivia"
            assert request("GET", "/usuarios/me")["nombre"] == "Persona local 0"
            assert request("PATCH", "/usuarios/me", json={"ciudad": "Valdivia"})["ciudad"] == "Valdivia"
            request("PATCH", "/usuarios/me", status=422, json={"edad": 99})
            request("PATCH", "/local/v1/perfil", person=1, json={"presupuesto": 300000, "zona_interes": "Centro", "ocupacion": "Estudiante"})
            request("PATCH", "/local/v1/perfil", person=1, status=422, json={"administrator": True})
            assert len(request("GET", "/conexiones/usuarios/buscar?presupuesto_max=300000&zona=Centro&ocupacion=Estudiante", person=None)) == 1
            request("GET", "/conexiones/usuarios/otros", person=None, status=401)
            for viewer in (0, 1):
                results = request("GET", "/conexiones/usuarios/otros", person=viewer)
                visible_ids = {row["id_usuario_PK"] for row in results}
                assert business_ids[viewer] not in visible_ids
                assert set(business_ids) - {business_ids[viewer]} <= visible_ids
            filtered = "/conexiones/usuarios/otros?presupuesto_max=300000&zona=Centro&ocupacion=Estudiante"
            assert request("GET", filtered, person=1) == []
            assert [row["id_usuario_PK"] for row in request("GET", filtered, person=0)] == [business_ids[1]]
            ids = [request("GET", f"/conexiones/usuarios/{i}")["id_usuario_PK"] for i in business_ids]
            if baseline["publicaciones"]:
                assert min(ids)>6000
                request("POST", "/api/publicaciones/1/postulaciones", person=1, status=409)
            publication = {"titulo": "Habitación local", "descripcion": "Datos ficticios de prueba", "ubicacion": "Valdivia", "precio": "250000", "tipo": "Arrendador", "categoria": "ofrezco", "tipo_vivienda": "habitacion", "mascota": "no", "cupos_totales": "2"}
            pub = request("POST", "/api/publicaciones", status=201, data=publication)["id"]
            shared = request("POST", "/api/publicaciones", status=201, data={**publication, "titulo": "Compartida local", "tipo": "Compartida"})["id"]
            assert len(request("GET", "/api/mis-publicaciones")) == 2
            assert request("GET", f"/api/publicaciones/{pub}/cupos", person=None)["cupos_disponibles"] == 2
            request("GET", f"/api/publicaciones/{pub}", person=1, status=404)
            request("PUT", f"/api/publicaciones/{pub}", person=1, status=404, data=publication)
            request("POST", f"/api/publicaciones/{pub}/postulaciones", status=403)
            request("POST", f"/api/publicaciones/{shared}/postulaciones", person=1, status=403)
            app = request("POST", f"/api/publicaciones/{pub}/postulaciones", person=1, status=201)["id_postulacion"]
            request("POST", f"/api/publicaciones/{pub}/postulaciones", person=1, status=409)
            request("GET", f"/api/publicaciones/{pub}/postulantes", person=1, status=404)
            request("PATCH", f"/api/postulaciones/{app}/estado", person=2, status=403, json={"estado": "Preseleccionada"})
            request("PATCH", f"/api/postulaciones/{app}/estado", status=409, json={"estado": "Aceptada"})
            request("PATCH", f"/api/postulaciones/{app}/estado", json={"estado": "Preseleccionada"})
            assert request("PATCH", f"/api/postulaciones/{app}/estado", json={"estado": "Aceptada"})["incorporacion_pendiente"]
            assert request("GET", f"/api/publicaciones/{pub}/cupos")["cupos_disponibles"] == 2
            assert request("GET", "/api/postulaciones/mias", person=1)[0]["estado"] == "Aceptada"
            second = request("POST", f"/api/publicaciones/{pub}/postulaciones", person=2, status=201)["id_postulacion"]
            request("PATCH", f"/api/postulaciones/{second}/estado", status=422, json={"estado": "Rechazada"})
            request("PATCH", f"/api/postulaciones/{second}/estado", json={"estado": "Rechazada", "motivo": "Selección finalizada"})
            cancelled = request("POST", f"/api/publicaciones/{pub}/postulaciones", person=2, status=201)["id_postulacion"]
            request("PATCH", f"/api/postulaciones/{cancelled}/estado", person=2, json={"estado": "Cancelada", "motivo": "Otra alternativa"})
            connection = request("POST", "/conexiones/", status=201, json={"id_receptor_FK": ids[1]})["id_conexion"]
            request("POST", "/conexiones/", person=1, status=400, json={"id_receptor_FK": ids[0]})
            request("POST", "/conexiones/", status=403, json={"id_receptor_FK": ids[2], "id_solicitante_FK": ids[1]})
            request("PUT", f"/conexiones/{connection}", person=2, status=403, json={"estado": "Aceptada"})
            request("PUT", f"/conexiones/{connection}", person=1, json={"estado": "Aceptada"})
            assert len(request("GET", "/conexiones/aceptadas", person=1)) == 1
            request("DELETE", f"/conexiones/{connection}", person=2, status=403)
            request("GET", "/api/admin/resumen", person=1, status=403)
            summary = request("GET", "/api/admin/resumen")
            assert summary == {key:baseline[key]+value for key,value in {"usuarios":3,"publicaciones":2,"conexiones":1}.items()}, summary
            request("GET", "/api/admin/publicaciones")
            request("GET", "/internal/v1/identidad", status=404)
            request("PATCH", f"/api/publicaciones/{pub}/cerrar")
            request("POST", f"/api/publicaciones/{pub}/postulaciones", person=2, status=409)
            for _ in range(40):
                notices = request("GET", "/local/v1/notificaciones", person=1)
                if len(notices) == 2: break
                time.sleep(.1)
            assert len(notices) == 2, notices
            for override in ({"exp": int(time.time())-60}, {"aud": "other"}, {"iss": "http://wrong/auth/v1"}, {"session_id": "fake"}):
                token = identity.session(people[1]["user"], **override)["access_token"]
                response = client.get(origins["gateway"] + "/local/v1/perfil", headers={"Authorization": "Bearer " + token})
                assert response.status_code == 401, response.text
                checks += 1
            request("POST", "/local/v1/sesion/revocar", person=1)
            request("GET", "/local/v1/perfil", person=1, status=401)
            request("GET", "/api/mis-publicaciones", person=1, status=401)
            print(f"PASS {checks} comprobaciones HTTP: identidad, perfil, publicaciones, postulaciones, notificaciones, conexiones, admin y revocación", flush=True)
            if web:
                from web_integration import run_web
                run_web(fixture, common, identity, origins["gateway"], processes)
        except Exception:
            for log in logs:
                log.flush(); log.seek(0)
                output = log.read().decode(errors="replace")
                for url in urls.values(): output = output.replace(url, "[DSN local oculto]")
                print(output[-5000:], flush=True)
            raise
        finally:
            # run_stack termina los procesos antes de borrar el clúster.
            for log in logs: log.close()
