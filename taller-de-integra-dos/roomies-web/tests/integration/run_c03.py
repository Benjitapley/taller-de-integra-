"""C03: procesos HTTP reales, roles PostgreSQL propios y fallos de red controlados."""
import argparse
from concurrent.futures import ThreadPoolExecutor
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import tempfile
import threading
import time
from uuid import uuid4

import httpx
import psycopg

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "backend/local_stack"))
from testing_identity import IdentityFixture


def port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


class FaultProxy:
    """Solo reenvía a un origen loopback fijo; puede retener o perder una respuesta."""
    def __init__(self, target, selected):
        self.target, self.selected = target, selected
        self.mode, self.keys = "pass", []
        self.gate, self.entered = threading.Event(), threading.Event()
        self.gate.set()
        proxy = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *_): pass
            def do_GET(self): self.forward()
            def do_POST(self): self.forward()
            def do_PUT(self): self.forward()
            def do_DELETE(self): self.forward()

            def forward(self):
                body = self.rfile.read(int(self.headers.get("Content-Length", "0")))
                selected = proxy.selected(self.command, self.path)
                mode = proxy.mode if selected else "pass"
                if selected:
                    proxy.keys.append(self.headers.get("Idempotency-Key"))
                    proxy.entered.set()
                try:
                    if mode == "hold" and not proxy.gate.wait(20):
                        return self.reply(503, b'{}')
                    if mode == "unavailable":
                        return self.reply(503, b'{}')
                    headers = {name: self.headers[name] for name in ("Content-Type", "Authorization", "X-Roomies-Service", "Idempotency-Key") if name in self.headers}
                    with httpx.Client(timeout=15, trust_env=False, follow_redirects=False) as client:
                        response = client.request(self.command, proxy.target + self.path, content=body, headers=headers)
                    if mode == "drop" and response.status_code == 201:
                        self.close_connection = True
                        return
                    self.reply(response.status_code, response.content, response.headers.get("Idempotency-Replayed"))
                except (httpx.HTTPError, BrokenPipeError, ConnectionResetError):
                    self.close_connection = True

            def reply(self, status, body, replay=None):
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                if replay is not None: self.send_header("Idempotency-Replayed", replay)
                self.end_headers()
                self.wfile.write(body)

        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.server.daemon_threads = True
        self.origin = f"http://127.0.0.1:{self.server.server_port}"
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)

    def set(self, mode):
        self.entered.clear()
        self.mode = mode
        self.gate.clear() if mode == "hold" else self.gate.set()

    def __enter__(self):
        self.thread.start()
        return self

    def __exit__(self, *_):
        self.gate.set()
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=5)


def eventually(check, seconds=30):
    deadline = time.monotonic() + seconds
    while time.monotonic() < deadline:
        result = check()
        if result: return result
        time.sleep(.15)
    raise AssertionError("La operación no convergió dentro del plazo local de prueba.")


def scenarios(client, gateway, people, database, admission_proxy, callbacks, restart_listado):
    def request(method, path, person=0, expected=(200,), **kwargs):
        response = client.request(method, gateway + path, headers={"Authorization": "Bearer " + people[person]["access_token"], **kwargs.pop("headers", {})}, **kwargs)
        assert response.status_code in expected, (method, path, response.status_code, response.text[:300])
        return response

    def publication(capacity):
        data = {"titulo": "Arriendo sintético C03", "descripcion": "Solo pruebas locales", "ubicacion": "Temuco", "precio": "250000", "tipo": "Arrendador", "categoria": "ofrezco", "tipo_vivienda": "habitacion", "mascota": "no", "cupos_totales": str(capacity), "id_region": "9", "id_comuna": "9101"}
        return request("POST", "/api/publicaciones", expected=(201,), data=data).json()["id_publicacion"], data

    def application(publication_id, person):
        id = request("POST", f"/api/publicaciones/{publication_id}/postulaciones", person, (201,)).json()["id_postulacion"]
        request("PATCH", f"/api/postulaciones/{id}/estado", json={"estado": "Preseleccionada"})
        return id

    def accept(id, key=None, expected=(200, 202, 409)):
        return request("PATCH", f"/api/postulaciones/{id}/estado", expected=expected, json={"estado": "Aceptada"}, headers={"Idempotency-Key": key or str(uuid4())})

    def terminal(id):
        def read():
            row = request("GET", f"/api/postulaciones/{id}").json()
            return row if row["estado"] == "Aceptada" or row.get("operacion", {}).get("estado") == "Rechazada" else None
        return eventually(read)

    def count(user=None, publication_id=None):
        where, params = ["estado='Activa'"], []
        if user is not None: where.append("id_usuario=%s"); params.append(user)
        if publication_id is not None:
            where.append("id_arriendo IN (SELECT id_arriendo FROM convivencia_mensajeria.arriendo WHERE id_publicacion=%s)"); params.append(publication_id)
        return database.execute("SELECT count(*) FROM convivencia_mensajeria.pertenencia WHERE " + " AND ".join(where), params).fetchone()[0]

    ids = [person["business_id"] for person in people]
    pub, _ = publication(2)
    a, b = application(pub, 1), application(pub, 2)
    request("PATCH", f"/api/postulaciones/{a}/estado", 8, (403,), json={"estado": "Aceptada"}, headers={"Idempotency-Key": str(uuid4())})
    key = str(uuid4())
    accept(a, key)
    accepted_a = terminal(a)
    accept(b)
    accepted_b = terminal(b)
    assert accepted_a["estado"] == accepted_b["estado"] == "Aceptada"
    assert accepted_a["id_arriendo"] == accepted_b["id_arriendo"]
    assert count(publication_id=pub) == 2 and count(user=ids[0]) == 0
    assert request("GET", "/api/arriendos/mio", 1).json()["id_arriendo"] == accepted_a["id_arriendo"]
    assert request("GET", "/api/arriendos/mio", 2).json()["id_arriendo"] == accepted_a["id_arriendo"]
    accept(a, key, (200,))
    assert count(publication_id=pub) == 2
    request("GET", f"/api/postulaciones/{a}", 8, (404,))
    request("PATCH", f"/api/postulaciones/{b}/estado", expected=(409,), json={"estado": "Aceptada"}, headers={"Idempotency-Key": key})
    print("PASS admisión efectiva, mismo arriendo, permisos, replay y clave con otro recurso", flush=True)

    pub, _ = publication(1)
    applications = [application(pub, person) for person in (3, 4)]
    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(accept, applications))
    results = [terminal(id) for id in applications]
    assert sorted(row["estado"] for row in results) == ["Aceptada", "Preseleccionada"]
    assert count(publication_id=pub) == 1
    print("PASS dos procesos HTTP disputan el último cupo sin sobreocupación", flush=True)

    pubs = [publication(1)[0] for _ in range(2)]
    applications = [application(pub, 5) for pub in pubs]
    with ThreadPoolExecutor(max_workers=2) as pool:
        list(pool.map(accept, applications))
    assert sum(terminal(id)["estado"] == "Aceptada" for id in applications) == 1
    assert count(user=ids[5]) == 1
    print("PASS pertenencia única ante dos arriendos concurrentes", flush=True)

    admission_proxy.set("hold")
    pub, data = publication(1)
    id, key = application(pub, 6), str(uuid4())
    result = accept(id, key, (202,)).json()
    assert result["estado"] == "Preseleccionada" and result["incorporacion_pendiente"] is True
    request("PATCH", f"/api/publicaciones/{pub}/cerrar", expected=(409,))
    request("PUT", f"/api/publicaciones/{pub}", expected=(409,), data={**data, "cupos_totales": "2"})
    assert count(publication_id=pub) == 0
    admission_proxy.set("pass")
    assert terminal(id)["estado"] == "Aceptada" and count(publication_id=pub) == 1
    print("PASS timeout conserva intención, bloquea cierre/capacidad y recupera", flush=True)

    admission_proxy.set("drop")
    pub, _ = publication(1)
    id, key = application(pub, 7), str(uuid4())
    accept(id, key, (200, 202))
    eventually(lambda: count(publication_id=pub) == 1)
    admission_proxy.set("pass")
    assert terminal(id)["estado"] == "Aceptada"
    accept(id, key, (200,))
    assert count(publication_id=pub) == 1
    print("PASS respuesta perdida después del commit converge sin duplicados", flush=True)

    callbacks.set("unavailable")
    pub, _ = publication(1)
    id = application(pub, 9)
    accept(id)
    assert terminal(id)["estado"] == "Aceptada"
    assert request("GET", f"/api/publicaciones/{pub}", 9).json()["cupos_disponibles"] == 0
    callbacks.set("pass")
    eventually(lambda: database.execute("SELECT ocupacion_confirmada FROM listado_applications.publicacion WHERE id_publicacion=%s", (pub,)).fetchone()[0] == 1)
    print("PASS confirmación interrumpida conserva cupo y proyección recuperable", flush=True)

    admission_proxy.set("hold")
    pub, _ = publication(1)
    id, key = application(pub, 10), str(uuid4())
    accept(id, key, (202,))
    restart_listado()
    admission_proxy.set("pass")
    assert terminal(id)["estado"] == "Aceptada"
    assert count(publication_id=pub) == 1
    accept(id, key, (200,))
    print("PASS reinicio del proceso recupera la operación persistida con la misma UUID", flush=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pg-bin", type=Path)
    args = parser.parse_args()
    candidates = [args.pg_bin] if args.pg_bin else []
    found = shutil.which("initdb")
    if found: candidates.append(Path(found).parent)
    candidates.extend(sorted(Path("C:/Program Files/PostgreSQL").glob("*/bin"), reverse=True))
    suffix = ".exe" if os.name == "nt" else ""
    binaries = next((p for p in candidates if (p / ("initdb" + suffix)).is_file()), None)
    if not binaries: raise SystemExit("Falta PostgreSQL local; usa --pg-bin.")
    clean = {k: v for k, v in os.environ.items() if k.upper() in {"SYSTEMROOT", "WINDIR", "TEMP", "TMP", "COMSPEC", "PATH"}}
    os.environ.clear()
    os.environ.update(clean)
    sys.dont_write_bytecode = True
    temporary = Path(tempfile.mkdtemp(prefix="roomies-c03-integration-"))
    data, started, processes, logs = temporary / "data", False, {}, []
    flags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0

    def command(name, *parameters):
        with (temporary / f"{name}.log").open("ab") as log:
            result = subprocess.run([str(binaries / (name + suffix)), *map(str, parameters)], stdin=subprocess.DEVNULL, stdout=log, stderr=log, timeout=40, creationflags=flags)
        if result.returncode: raise AssertionError(f"Falló {name} del clúster temporal.")

    def stop(name):
        process = processes.get(name)
        if process and process.poll() is None:
            process.terminate()
            process.wait(timeout=15)

    try:
        pg_port = port()
        command("initdb", "-D", data, "-U", "c03_admin", "--encoding=UTF8", "--locale=C", "--auth-local=trust", "--auth-host=trust")
        started = True
        command("pg_ctl", "-D", data, "-l", temporary / "postgres.log", "-o", f"-h 127.0.0.1 -p {pg_port}", "-w", "-t", "15", "start")
        admin = f"postgresql://c03_admin@127.0.0.1:{pg_port}/postgres"
        with psycopg.connect(admin, autocommit=True) as database:
            database.execute("CREATE DATABASE roomies_sprint2_disposable")
        admin = admin.rsplit("/", 1)[0] + "/roomies_sprint2_disposable"
        with psycopg.connect(admin, autocommit=True) as database:
            database.execute((ROOT / "backend/local_stack/bootstrap.sql").read_text(encoding="utf-8"))
            database.execute("CREATE ROLE sql_convivencia_mensajeria LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS")
            database.execute("GRANT CONNECT ON DATABASE roomies_sprint2_disposable TO sql_convivencia_mensajeria")
            for service in ("listado-applications-service", "convivencia-mensajeria-service"):
                for migration in sorted((ROOT / "backend/services" / service / "migrations").glob("*.sql")):
                    if ".down." not in migration.name:
                        database.execute(migration.read_text(encoding="utf-8"))

        origins = {name: f"http://127.0.0.1:{port()}" for name in ("auth", "listado", "convivencia", "gateway")}
        admin_key = "sb_secret_disposable_c03_only_000000000000"
        with IdentityFixture(admin_key=admin_key) as identity, FaultProxy(origins["convivencia"], lambda method, path: path == "/internal/incorporaciones") as admission_proxy, FaultProxy(origins["listado"], lambda method, path: method in {"PUT", "DELETE"} and "/reservas/" in path) as callbacks, httpx.Client(timeout=20, trust_env=False) as client:
            allowed = [pg_port, identity.server.server_port, admission_proxy.server.server_port, callbacks.server.server_port, *[int(value.rsplit(":", 1)[1]) for value in origins.values()]]
            common = {**clean, "ROOMIES_LOCAL_MODE": "1", "ROOMIES_RUNTIME_MODE": "disposable", "ROOMIES_PERSISTENCE_LAYOUT": "private-v1", "ROOMIES_TEST_RUNNER": "disposable-only", "ROOMIES_ALLOWED_PORTS": json.dumps(allowed), "ROOMIES_AUTH_PROVIDER_URL": identity.origin, "ROOMIES_AUTH_PUBLISHABLE_KEY": identity.publishable_key, "ROOMIES_INTERNAL_TOKEN": "synthetic-c03-service-key-000000000000", "ROOMIES_CURSOR_SECRET": "synthetic-c03-cursor-key-000000000000", "AUTH_USERS_UPSTREAM_URL": origins["auth"], "LISTADO_UPSTREAM_URL": origins["listado"], "CONVIVENCIA_UPSTREAM_URL": admission_proxy.origin}
            roles = {"auth": "sql_auth_users", "listado": "sql_listado_applications", "convivencia": "sql_convivencia_mensajeria"}
            variables = {"auth": "AUTH_USERS_DATABASE_URL", "listado": "LISTADO_DATABASE_URL", "convivencia": "CONVIVENCIA_DATABASE_URL"}

            def start(name):
                env = {**common, "ROOMIES_PORT": origins[name].rsplit(":", 1)[1]}
                if name == "auth": env["ROOMIES_SUPABASE_AUTH_ADMIN_KEY"] = admin_key
                if name in roles: env[variables[name]] = f"postgresql://{roles[name]}@127.0.0.1:{pg_port}/roomies_sprint2_disposable"
                if name == "convivencia": env["LISTADO_UPSTREAM_URL"] = callbacks.origin
                log = (temporary / f"{name}.log").open("ab")
                logs.append(log)
                process = subprocess.Popen([sys.executable, "-I", "-B", str(ROOT / "backend/local_stack/serve.py"), name], env=env, stdin=subprocess.DEVNULL, stdout=log, stderr=log, creationflags=flags)
                processes[name] = process
                def ready():
                    if process.poll() is not None:
                        details = Path(log.name).read_text(encoding="utf-8", errors="replace")
                        raise AssertionError(f"No inició {name}:\n{details[-4000:]}")
                    try: return client.get(origins[name] + "/health").status_code == 200
                    except httpx.HTTPError: return False
                eventually(ready, 20)

            for name in ("auth", "listado", "convivencia", "gateway"): start(name)
            people = []
            for index in range(11):
                email = f"c03-{index}@example.com"
                response = client.post(identity.origin + "/auth/v1/signup", headers={"apikey": identity.publishable_key}, json={"email": email, "password": "Synthetic-password-123", "data": {"nombre": f"Prueba {index}", "fecha_nacimiento": "2000-01-01"}})
                assert response.status_code == 200
                person = client.post(identity.origin + "/auth/v1/verify", headers={"apikey": identity.publishable_key}, json={"email": email, "token": identity.users[email]["otp"]}).json()
                response = client.post(origins["gateway"] + "/local/v1/perfil/inicializacion", headers={"Authorization": "Bearer " + person["access_token"]}, json={"nombre": f"Prueba {index}", "fecha_nacimiento": "2000-01-01"})
                assert response.status_code == 200, response.text[:200]
                person["business_id"] = response.json()["id_usuario"]
                people.append(person)
            with psycopg.connect(admin, autocommit=True) as database:
                scenarios(client, origins["gateway"], people, database, admission_proxy, callbacks, lambda: (stop("listado"), start("listado")))
            print("PASS C03: cuatro procesos separados y SQL real; Auth externo simulado explícitamente", flush=True)
    finally:
        for name in reversed(list(processes)): stop(name)
        for log in logs: log.close()
        if started: command("pg_ctl", "-D", data, "-m", "immediate", "-w", "-t", "15", "stop")
        if temporary.parent.resolve() == Path(tempfile.gettempdir()).resolve() and temporary.name.startswith("roomies-c03-integration-") and not (data / "postmaster.pid").exists():
            shutil.rmtree(temporary)


if __name__ == "__main__":
    main()
