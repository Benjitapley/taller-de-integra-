"""Destinos explícitos: laboratorio desechable o proyecto Supabase identificado."""
import os
import re
from urllib.parse import urlsplit, parse_qsl, unquote

from .contracts import DependencyUnavailable

def persistence_layout():
    value = os.environ.get("ROOMIES_PERSISTENCE_LAYOUT", "private-v1")
    if value not in {"private-v1", "haycupo-v1"}:
        raise DependencyUnavailable("Estructura de persistencia no reconocida.")
    return value


def local_mode():
    if os.environ.get("ROOMIES_LOCAL_MODE") != "1":
        raise DependencyUnavailable("La topología local no está habilitada.")


def runtime_mode():
    mode = os.environ.get("ROOMIES_RUNTIME_MODE", "disposable")
    if mode == "supabase" and os.environ.get("ROOMIES_LOCAL_MODE") != "1":
        project_ref()
        return mode
    if mode == "disposable" and os.environ.get("ROOMIES_LOCAL_MODE") == "1":
        return mode
    raise DependencyUnavailable("Selecciona un único entorno de persistencia explícito.")


def project_ref():
    value = os.environ.get("ROOMIES_SUPABASE_PROJECT_REF", "")
    if not re.fullmatch(r"[a-z0-9]{20}", value):
        raise DependencyUnavailable("Falta identificar el proyecto Supabase.")
    return value


def auth_provider_url():
    if runtime_mode() == "supabase":
        expected = f"https://{project_ref()}.supabase.co"
        if os.environ.get("ROOMIES_AUTH_PROVIDER_URL", "").rstrip("/") != expected:
            raise DependencyUnavailable("Auth debe pertenecer al proyecto Supabase seleccionado.")
        return expected
    return service_url("ROOMIES_AUTH_PROVIDER_URL", docker_hosts=("supabase-auth", "host.docker.internal"))


def database_url(variable, role):
    mode = runtime_mode()
    value = os.environ.get(variable, "")
    try:
        parsed = urlsplit(value)
        if mode == "supabase":
            ref = project_ref()
            host = os.environ.get("ROOMIES_SUPABASE_DB_HOST", "")
            direct = host == f"db.{ref}.supabase.co"
            pooled = bool(re.fullmatch(r"aws-[0-9]+-[a-z0-9-]+\.pooler\.supabase\.com", host))
            pairs = parse_qsl(parsed.query, keep_blank_values=True)
            query = dict(pairs)
            valid = (parsed.scheme in {"postgresql", "postgres"} and parsed.hostname == host and
                     (direct or pooled) and parsed.port in ({5432} if direct else {5432, 6543}) and
                     unquote(parsed.username or "") == (role if direct else f"{role}.{ref}") and
                     bool(parsed.password) and parsed.path == "/postgres" and not parsed.fragment and
                     len(pairs) == len(query) and set(query) == {"sslmode", "sslrootcert"} and
                     query["sslmode"] == "verify-full" and bool(query["sslrootcert"]) and
                     not any(c in query["sslrootcert"] for c in "\r\n\x00"))
        else:
            valid = (parsed.scheme in {"postgresql", "postgres"} and
                 parsed.username == role and parsed.path == "/roomies_sprint2_disposable" and
                 not parsed.query and not parsed.fragment and
                 ((parsed.hostname == "127.0.0.1" and parsed.port and 1024 <= parsed.port <= 65535) or
                  (parsed.hostname == "roomies-db" and parsed.port == 5432)))
    except ValueError:
        valid = False
    if not valid:
        raise DependencyUnavailable("Destino PostgreSQL, TLS o rol del servicio no válidos.")
    return value


def service_url(variable, *, docker_hosts=()):
    runtime_mode()
    value = os.environ.get(variable, "")
    try:
        parsed = urlsplit(value)
        valid = (parsed.scheme == "http" and parsed.hostname in {"127.0.0.1", "localhost", *docker_hosts} and
                 parsed.port and not parsed.username and not parsed.password and
                 parsed.path in {"", "/"} and not parsed.query and not parsed.fragment)
    except ValueError:
        valid = False
    if not valid:
        raise DependencyUnavailable("El servicio local no está configurado.")
    return value.rstrip("/")
