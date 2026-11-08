"""Arranque desde localhost sin migraciones ni lectura automática de dotenv."""
import argparse
import os
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument("service", choices=["auth", "listado", "match", "gateway"])
parser.add_argument("--port", type=int)
parser.add_argument("--env-file", type=Path, help="Configuración privada explícita; no carga .env automáticamente")
parser.add_argument("--check", action="store_true", help="Comprobar conexión y tablas con transacción de solo lectura")
args = parser.parse_args()
if args.env_file:
    from dotenv import load_dotenv
    if not args.env_file.is_file(): raise SystemExit("Falta el archivo de configuración privado.")
    load_dotenv(args.env_file, override=True)
variables = {"auth": "AUTH_USERS_DATABASE_URL", "listado": "LISTADO_DATABASE_URL", "match": "MATCH_DATABASE_URL"}
for name in {"DATABASE_URL", *variables.values()} - {variables.get(args.service)}:
    os.environ.pop(name, None)
paths = {"auth": "backend/services/auth-users-service", "listado": "backend/services/listado-applications-service",
         "match": "backend/services/match-conexion-service", "gateway": "backend/api-gateway"}
sys.path[:0] = [str(ROOT / paths[args.service]), str(ROOT)]
from backend.service_runtime.settings import runtime_mode, auth_provider_url, database_url, persistence_layout

try:
    mode = runtime_mode()
    if mode == "supabase" and args.service != "gateway":
        required = [variables[args.service]]
        if args.service == "auth": required.append("ROOMIES_AUTH_PUBLISHABLE_KEY")
        if args.service in {"auth", "listado"}: required.append("ROOMIES_INTERNAL_TOKEN")
        if any(not os.environ.get(name) or "REPLACE_" in os.environ[name] for name in required):
            raise ValueError("Completa la configuración autorizada")
    if args.service != "gateway":
        auth_provider_url()
        variable, role = {"auth": ("AUTH_USERS_DATABASE_URL", "sql_auth_users"),
                          "listado": ("LISTADO_DATABASE_URL", "sql_listado_applications"),
                          "match": ("MATCH_DATABASE_URL", "sql_match_conexion")}[args.service]
        database_url(variable, role)
    port = args.port or {"auth": 8001, "listado": 8002, "match": 8003, "gateway": 8000}[args.service]
    if not 1024 <= port <= 65535: raise ValueError()
    if args.check:
        import httpx
        if args.service == "gateway":
            for name in ("AUTH_USERS_UPSTREAM_URL", "LISTADO_UPSTREAM_URL", "MATCH_UPSTREAM_URL"):
                with httpx.Client(timeout=5, trust_env=False) as client:
                    client.get(os.environ[name] + "/health").raise_for_status()
        else:
            import psycopg
            from psycopg import sql
            progressive = persistence_layout() == "haycupo-v1"
            checks = {"auth": [("haycupo.usuario", "id_usuario"), ("auth_users.identidad", "supabase_user_id")] if progressive else [("auth_users.usuario", "supabase_user_id")],
                      "listado": [("haycupo.publicacion" if progressive else "listado_applications.publicacion", "id_publicacion"), ("listado_applications.postulacion", "id_postulacion")],
                      "match": [("haycupo.conexion" if progressive else "match_conexion.conexion", "id_conexion")]}
            with psycopg.connect(database_url(variable, role), prepare_threshold=None, connect_timeout=5) as connection:
                connection.read_only = True
                assert connection.execute("SELECT current_user").fetchone()[0] == role
                for table, column in checks[args.service]:
                    connection.execute(sql.SQL("SELECT {} FROM {} LIMIT 0").format(sql.Identifier(column),sql.Identifier(*table.split("."))))
            with httpx.Client(timeout=5, trust_env=False) as client:
                response = client.get(auth_provider_url() + "/auth/v1/.well-known/jwks.json")
                response.raise_for_status()
                assert any(key.get("alg") in {"ES256", "RS256"} for key in response.json()["keys"])
except Exception:
    raise SystemExit("Configuración o comprobación fallida: revisa modo, proyecto, URL Auth, DSN del rol y TLS. No se ejecutaron migraciones.") from None

if args.check:
    print("PASS comprobación de solo lectura; no acredita registro ni persistencia de usuarios.")
    raise SystemExit(0)

import uvicorn
uvicorn.run("app.main:app", host="127.0.0.1", port=port, access_log=False, proxy_headers=False)
