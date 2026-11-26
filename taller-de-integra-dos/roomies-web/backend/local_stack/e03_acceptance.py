"""E03: navegador, BFF, Gateway y servicios sobre PostgreSQL real desechable.

La identidad es una fixture explícita; este ensayo NO acredita Supabase/Kubero.
No modifica roomies_local ni usuarios de un proveedor externo.
"""
import argparse
from contextlib import ExitStack
from datetime import datetime, timedelta, timezone
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from urllib.parse import quote
from uuid import uuid4

import httpx
import psycopg
from psycopg import sql

from testing_identity import IdentityFixture

ROOT = Path(__file__).resolve().parents[2]
FRONT = ROOT / "frontend-next"
HERE = Path(__file__).resolve().parent


def free_port():
    with socket.socket() as sock:
        sock.bind(("127.0.0.1", 0))
        return sock.getsockname()[1]


def migrate(connection, database):
    bootstrap = (HERE / "bootstrap.sql").read_text(encoding="utf-8")
    bootstrap = bootstrap.replace("roomies_sprint2_disposable", database)
    bootstrap = re.sub(r"^CREATE ROLE .*;\s*$", "", bootstrap, flags=re.M)
    bootstrap = bootstrap.replace("CREATE SCHEMA auth_users;", "")
    bootstrap = re.sub(r"CREATE TABLE auth_users.usuario \(.*?\n\);", "", bootstrap, count=1, flags=re.S)
    paths = sorted((ROOT / "backend/services/auth-users-service/migrations").glob("*.up.sql"))
    sources = [(str(p.relative_to(ROOT)), p.read_text(encoding="utf-8")) for p in paths]
    sources += [("bootstrap-adaptado", bootstrap), ("local-runtime", (HERE / "local_runtime.up.sql").read_text(encoding="utf-8"))]
    for service in ("listado-applications-service", "convivencia-mensajeria-service"):
        for path in sorted((ROOT / "backend/services" / service / "migrations").glob("*.sql")):
            if ".down." not in path.name:
                sources.append((str(path.relative_to(ROOT)), path.read_text(encoding="utf-8")))
    for _, body in sources:
        connection.execute(re.sub(r"^\s*(?:BEGIN|COMMIT);\s*$", "", body, flags=re.M), prepare=False)
    connection.execute(sql.SQL("GRANT CONNECT ON DATABASE {} TO sql_convivencia_mensajeria").format(sql.Identifier(database)))
    return {name: hashlib.sha256(body.encode()).hexdigest() for name, body in sources}


def seed(connection, people):
    ids = []
    for person in people:
        ids.append(connection.execute("""INSERT INTO auth_users.usuario(supabase_user_id,nombre,fecha_nacimiento)
            VALUES(%s,%s,'2000-01-01') RETURNING id_usuario""",
            (person["subject"], person["nombre"])).fetchone()[0])
    publication = connection.execute("""INSERT INTO listado_applications.publicacion
        (id_usuario,tipo,titulo,descripcion,precio,ubicacion,cupos_totales,categoria,tipo_vivienda,mascota)
        VALUES(%s,'Arrendador','Prueba E03','Datos sintéticos',200000,'Temuco',2,'ofrezco','habitacion','no')
        RETURNING id_publicacion""", (ids[2],)).fetchone()[0]
    rental = connection.execute("""INSERT INTO convivencia_mensajeria.arriendo
        (id_publicacion,cupos_totales,version_capacidad) VALUES(%s,2,1) RETURNING id_arriendo""", (publication,)).fetchone()[0]
    entered = datetime.now(timezone.utc) - timedelta(minutes=5)
    for index in (0, 1):
        operation = uuid4()
        connection.execute("""INSERT INTO convivencia_mensajeria.incorporacion
            (id_operacion,payload,estado,http_status,respuesta) VALUES(%s,'{}','Terminada',201,'{}')""", (operation,))
        connection.execute("""INSERT INTO convivencia_mensajeria.pertenencia
            (id_arriendo,id_usuario,id_postulacion,id_operacion,creada_en) VALUES(%s,%s,%s,%s,%s)""",
            (rental, ids[index], index + 1, operation, entered))
    conversation = connection.execute("""INSERT INTO convivencia_mensajeria.conversacion(id_arriendo)
        VALUES(%s) RETURNING id_conversacion""", (rental,)).fetchone()[0]
    for index in range(-1, 45):
        connection.execute("""INSERT INTO convivencia_mensajeria.mensajes
            (id_conversacion,id_emisor,nombre_remitente,contenido,id_cliente,fecha_envio)
            VALUES(%s,%s,%s,%s,%s,%s)""", (conversation, ids[index % 2], people[index % 2]["nombre"],
            "PREINGRESO NO VISIBLE" if index < 0 else f"Historial E03 {index:02d}",
            uuid4(), entered + timedelta(seconds=index)))
    return {"rental": rental, "conversation": conversation, "users": ids}


def stop(process):
    if process.poll() is None:
        if os.name == "nt":
            subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"],
                stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, creationflags=subprocess.CREATE_NO_WINDOW)
        else:
            process.terminate()
        process.wait(timeout=15)


def postgres(stack, clean):
    """Clúster propio: no lee credenciales ni modifica la instancia del usuario."""
    configured = os.environ.get("POSTGRES_BIN")
    candidates = ([Path(configured)] if configured else []) + sorted(Path("C:/Program Files/PostgreSQL").glob("*/bin"), reverse=True)
    binary = ".exe" if os.name == "nt" else ""
    found = shutil.which("initdb")
    if found:
        candidates.insert(0, Path(found).parent)
    binaries = next((p for p in candidates if (p / ("initdb" + binary)).is_file()), None)
    if binaries is None:
        raise RuntimeError("Falta PostgreSQL; define POSTGRES_BIN.")
    temporary = Path(stack.enter_context(tempfile.TemporaryDirectory(prefix="roomies-e03-postgres-")))
    data = temporary / "data"
    flags = {"creationflags": subprocess.CREATE_NO_WINDOW} if os.name == "nt" else {}

    def command(name, *parameters):
        with (temporary / (name + ".log")).open("ab") as log:
            result = subprocess.run([str(binaries / (name + binary)), *map(str, parameters)],
                env=clean, stdout=log, stderr=log, timeout=45, **flags)
        if result.returncode:
            raise RuntimeError("Falló PostgreSQL efímero: " + name)

    password_file = temporary / "password"
    password = secrets.token_urlsafe(32)
    password_file.write_text(password, encoding="utf-8")
    command("initdb", "-D", data, "-U", "e03_test_admin", "--encoding=UTF8", "--locale=C",
        "--auth-local=trust", "--auth-host=scram-sha-256", "--pwfile", password_file)
    port = free_port()
    command("pg_ctl", "-D", data, "-l", temporary / "postgres.log", "-o", f"-h 127.0.0.1 -p {port}", "-w", "start")
    stack.callback(command, "pg_ctl", "-D", data, "-m", "immediate", "-w", "stop")
    admin = {"host": "127.0.0.1", "port": port, "user": "e03_test_admin", "password": password, "dbname": "postgres"}
    runtime = {}
    with psycopg.connect(**admin, autocommit=True, connect_timeout=5) as connection:
        for role in ("sql_auth_users", "sql_listado_applications", "sql_match_conexion", "sql_convivencia_mensajeria"):
            runtime[role] = secrets.token_urlsafe(32)
            connection.execute(sql.SQL("CREATE ROLE {} LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS PASSWORD {}")
                .format(sql.Identifier(role), sql.Literal(runtime[role])))
        connection.execute("CREATE DATABASE roomies_sprint2_disposable")
    print("READY PostgreSQL efímero propio; sin credenciales del usuario", flush=True)
    return admin, runtime


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--fixture-identity", action="store_true", required=True,
        help="Reconocer explícitamente que la identidad no es Supabase real")
    parser.add_argument("--evidence", type=Path, required=True, help="Directorio para resultados sanitizados y capturas")
    args = parser.parse_args()
    args.evidence.mkdir(parents=True, exist_ok=True)
    database = "roomies_sprint2_disposable"
    node = shutil.which("node")
    if not node or not (FRONT / "node_modules/playwright").is_dir():
        raise SystemExit("Faltan Node/Playwright instalados.")
    clean = {k: v for k, v in os.environ.items() if k.upper() in
        {"SYSTEMROOT", "WINDIR", "TEMP", "TMP", "COMSPEC", "PATH", "PATHEXT", "LOCALAPPDATA"}}
    flags = {"creationflags": subprocess.CREATE_NO_WINDOW} if os.name == "nt" else {}
    cluster = ExitStack()
    try:
        admin, runtime = postgres(cluster, clean)
        with ExitStack() as stack:
            identity = stack.enter_context(IdentityFixture())
            fixture = Path(stack.enter_context(tempfile.TemporaryDirectory(prefix="roomies-e03-http-")))
            application = Path(stack.enter_context(tempfile.TemporaryDirectory(prefix=".proxy-test-e03-", dir=FRONT)))
            people = []
            password = secrets.token_urlsafe(24)
            with httpx.Client(timeout=20, trust_env=False) as client:
                for index in range(4):
                    email = f"e03-{index}@example.com"
                    name = "Alex de prueba" if index < 2 else ("Dueño de prueba" if index == 2 else "Tercero de prueba")
                    response = client.post(identity.origin + "/auth/v1/signup", headers={"apikey": identity.publishable_key},
                        json={"email": email, "password": password, "data": {"nombre": name, "fecha_nacimiento": "2000-01-01"}})
                    response.raise_for_status()
                    record = identity.users[email]
                    record["user"]["email_confirmed_at"] = "2026-01-01T00:00:00Z"
                    people.append({"correo": email, "contrasena": password, "nombre": name, "subject": record["user"]["id"]})
                database_admin = {**admin, "dbname": database}
                with psycopg.connect(**database_admin) as connection:
                    migrations = migrate(connection, database)
                    context = seed(connection, people)
                ports = {name: free_port() for name in ("auth", "listado", "convivencia", "gateway", "web")}
                origins = {name: f"http://127.0.0.1:{port}" for name, port in ports.items()}
                common = {**clean, "ROOMIES_LOCAL_MODE": "1", "ROOMIES_RUNTIME_MODE": "disposable",
                    "ROOMIES_LOCAL_DATABASE": database, "ROOMIES_TEST_RUNNER": "disposable-only",
                    "ROOMIES_AUTH_PROVIDER_URL": identity.origin, "ROOMIES_AUTH_PUBLISHABLE_KEY": identity.publishable_key,
                    "AUTH_USERS_UPSTREAM_URL": origins["auth"], "LISTADO_UPSTREAM_URL": origins["listado"],
                    "CONVIVENCIA_UPSTREAM_URL": origins["convivencia"], "ROOMIES_INTERNAL_TOKEN": secrets.token_hex(32),
                    "ROOMIES_ALLOWED_PORTS": json.dumps([admin["port"], identity.server.server_port, *ports.values()])}
                roles = {"auth": ("AUTH_USERS_DATABASE_URL", "sql_auth_users"),
                    "listado": ("LISTADO_DATABASE_URL", "sql_listado_applications"),
                    "convivencia": ("CONVIVENCIA_DATABASE_URL", "sql_convivencia_mensajeria")}
                processes = {}

                def start(service):
                    env = {**common, "ROOMIES_PORT": str(ports[service])}
                    if service in roles:
                        variable, role = roles[service]
                        env[variable] = f"postgresql://{role}:{quote(runtime[role], safe='')}@127.0.0.1:{admin['port']}/{database}"
                    log = stack.enter_context(open(fixture / f"{service}.log", "w+b"))
                    process = subprocess.Popen([sys.executable, "-I", "-B", str(HERE / "serve.py"), service],
                        env=env, stdout=log, stderr=log, **flags)
                    processes[service] = process
                    stack.callback(stop, process)
                    for _ in range(150):
                        if process.poll() is not None:
                            raise RuntimeError(f"No inició {service}; revisar dependencias locales.")
                        try:
                            if client.get(origins[service] + "/health").status_code == 200:
                                print("READY", service, flush=True)
                                return
                        except httpx.HTTPError:
                            pass
                        time.sleep(.1)
                    raise RuntimeError("Timeout en " + service)

                for service in ("auth", "listado", "convivencia", "gateway"):
                    start(service)
                for name in ("next.config.ts", "package.json", "tsconfig.json", "src", "public"):
                    source = FRONT / name
                    if source.is_dir():
                        shutil.copytree(source, application / name)
                    else:
                        shutil.copy2(source, application / name)
                link = application / "node_modules"
                if os.name == "nt":
                    subprocess.run(["cmd", "/c", "mklink", "/J", str(link), str(FRONT / "node_modules")],
                        check=True, stdout=subprocess.DEVNULL, **flags)
                    stack.callback(os.rmdir, link)  # Retirar solo la junction antes del directorio temporal.
                else:
                    link.symlink_to(FRONT / "node_modules", target_is_directory=True)
                    stack.callback(link.unlink)
                env = {**common, "ROOMIES_RUNTIME_MODE": "disposable", "NEXT_TELEMETRY_DISABLED": "1",
                    "WEB_AUTH_ENABLED": "true", "WEB_AUTH_PROVIDER": "supabase", "WEB_PROFILE_CONTRACT": "local-v1",
                    "WEB_AUTH_ORIGIN": origins["web"], "WEB_AUTH_FASTAPI_ORIGIN": origins["gateway"],
                    "WEB_SUPABASE_ORIGIN": identity.origin, "WEB_SUPABASE_PUBLISHABLE_KEY": identity.publishable_key}
                log = stack.enter_context(open(fixture / "next.log", "w+b"))
                process = subprocess.Popen([node, str(FRONT / "node_modules/next/dist/bin/next"), "dev",
                    "--hostname", "127.0.0.1", "--port", str(ports["web"])], cwd=application,
                    env=env, stdout=log, stderr=log, **flags)
                stack.callback(stop, process)
                for _ in range(150):
                    if process.poll() is not None:
                        raise RuntimeError("No inició Next.js")
                    try:
                        if client.get(origins["web"] + "/").status_code == 200:
                            break
                    except httpx.HTTPError:
                        pass
                    time.sleep(.2)
                else:
                    raise RuntimeError("Timeout Next.js")
                print("READY web; identidad de contrato ficticia, SQL/HTTP reales", flush=True)
                # stdin privado: nunca se escriben cuentas, cookies o tokens en la evidencia.
                payload = {**context, "origin": origins["web"], "gateway": origins["gateway"],
                    "people": people, "evidence": str(args.evidence.resolve())}
                tested_sources = [HERE / "e03_browser.mjs", Path(__file__),
                    FRONT / "src/features/recorrido/ChatPreviewPage.tsx",
                    FRONT / "src/lib/recorrido/chat.ts",
                    ROOT / "backend/services/auth-users-service/app/api/routes/local_users.py"]
                source_hashes = {str(path.relative_to(ROOT)): hashlib.sha256(path.read_bytes()).hexdigest() for path in tested_sources}
                result = subprocess.run([node, str(HERE / "e03_browser.mjs")], input=json.dumps(payload),
                    text=True, env=clean, timeout=420, **flags)
                if result.returncode:
                    raise RuntimeError("La aceptación de navegador falló; no se acredita cierre.")
                # Reinicio real del proceso para comprobar que los mensajes no viven en memoria.
                stop(processes["convivencia"])
                start("convivencia")
                session = client.post(identity.origin + "/auth/v1/token?grant_type=password",
                    headers={"apikey": identity.publishable_key}, json={"email": people[0]["correo"], "password": password})
                session.raise_for_status()
                response = client.get(origins["gateway"] + f"/api/conversaciones/{context['conversation']}/mensajes",
                    headers={"Authorization": "Bearer " + session.json()["access_token"]})
                assert response.status_code == 200
                assert any(row["contenido"] == "Mensaje persistido tras respuesta perdida" for row in response.json()["items"])
                with psycopg.connect(**database_admin) as connection:
                    count = connection.execute("""SELECT count(*) FROM convivencia_mensajeria.mensajes
                        WHERE contenido='Mensaje persistido tras respuesta perdida'""").fetchone()[0]
                    assert count == 1
                    assert connection.execute("SELECT count(*) FROM convivencia_mensajeria.mensajes WHERE contenido='Acceso prohibido'").fetchone()[0] == 0
                evidence = {"date": datetime.now(timezone.utc).isoformat(),
                    "head": subprocess.check_output(["git", "rev-parse", "HEAD"], cwd=ROOT, text=True).strip(),
                    "identity": "fixture GoTrue/JWKS, NO Supabase", "database": "PostgreSQL real local, base propia efímera",
                    "restart_persistence": "passed", "retry_rows": count, "unauthorized_rows": 0,
                    "source_sha256": source_hashes, "migrations": migrations}
                (args.evidence / "integration.json").write_text(json.dumps(evidence, indent=2) + "\n", encoding="utf-8")
                print("PASS reinicio de Convivencia y una sola fila para el reintento", flush=True)
    finally:
        cluster.close()
        print("CLEANUP base/procesos propios; roomies_local conservada", flush=True)


if __name__ == "__main__":
    main()
