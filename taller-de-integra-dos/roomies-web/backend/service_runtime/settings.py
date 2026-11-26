"""Destinos explícitos para PostgreSQL y Supabase Auth."""
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
    if mode in {"supabase", "kubero"} and os.environ.get("ROOMIES_LOCAL_MODE") != "1":
        project_ref()
        return mode
    if mode == "disposable" and os.environ.get("ROOMIES_LOCAL_MODE") == "1":
        return mode
    if mode == "local-postgres" and os.environ.get("ROOMIES_LOCAL_MODE") == "1":
        return mode
    raise DependencyUnavailable("Selecciona un único entorno de persistencia explícito.")


def project_ref():
    value = os.environ.get("ROOMIES_SUPABASE_PROJECT_REF", "")
    if not re.fullmatch(r"[a-z0-9]{20}", value):
        raise DependencyUnavailable("Falta identificar el proyecto Supabase.")
    return value


def auth_provider_url():
    mode = runtime_mode()
    if mode in {"supabase", "kubero"} or (mode == "local-postgres" and os.environ.get("ROOMIES_AUTH_PROVIDER_URL", "").startswith("https://")):
        expected = f"https://{project_ref()}.supabase.co"
        if os.environ.get("ROOMIES_AUTH_PROVIDER_URL", "").rstrip("/") != expected:
            raise DependencyUnavailable("Auth debe pertenecer al proyecto Supabase seleccionado.")
        if mode == "kubero" and os.environ.get("ROOMIES_JWT_ISSUER", expected + "/auth/v1") != expected + "/auth/v1":
            raise DependencyUnavailable("El emisor JWT debe pertenecer al proyecto Supabase seleccionado.")
        return expected
    return service_url("ROOMIES_AUTH_PROVIDER_URL", docker_hosts=("supabase-auth", "host.docker.internal"))


def _kubero_database_matches(value, parsed, role):
    host = os.environ.get("ROOMIES_KUBERO_DB_HOST", "")
    port = os.environ.get("ROOMIES_KUBERO_DB_PORT", "")
    database = os.environ.get("ROOMIES_KUBERO_DB_NAME", "")
    ca = os.environ.get("ROOMIES_KUBERO_DB_SSLROOTCERT", "")
    label = r"[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?"
    userinfo, _, endpoint = parsed.netloc.rpartition("@")
    username, _, password = userinfo.partition(":")
    pairs = parse_qsl(parsed.query, keep_blank_values=True, strict_parsing=True, errors="strict")
    sslmode = os.environ.get("DB_SSLMODE", "verify-full")
    insecure_test = (
        sslmode == "disable"
        and os.environ.get("ROOMIES_RUNTIME_MODE") == "kubero"
        and os.environ.get("ROOMIES_DEPLOYMENT_ENV") == "test"
        and os.environ.get("ROOMIES_KUBERO_ALLOW_INSECURE_TEST_DB") == "true"
        and (host, port, database) == ("roomies-db-test2-postgres", "5432", "roomies-db-test2")
    )
    if insecure_test:
        expected_query = {"sslmode": "disable", "gssencmode": "disable"}
    elif sslmode == "verify-full":
        if not (os.path.isabs(ca) and os.path.isfile(ca)
                and not any(ord(char) < 32 or ord(char) == 127 for char in ca)):
            return False
        expected_query = {"sslmode": "verify-full", "sslrootcert": ca, "gssencmode": "disable"}
    else:
        return False
    return (
        parsed.scheme in {"postgresql", "postgres"}
        and bool(re.fullmatch(r"[!-~]+", value))
        and "#" not in value
        and "+" not in parsed.query
        and len(host) <= 253
        and bool(re.fullmatch(rf"(?:{label}\.)*[a-z](?:[a-z0-9-]{{0,61}}[a-z0-9])?", host))
        and host not in {"localhost", "server-postgres"}
        and bool(re.fullmatch(r"[1-9][0-9]{0,4}", port))
        and 1 <= int(port) <= 65535
        and endpoint == f"{host}:{port}"
        and username == role
        and bool(re.fullmatch(r"(?:[A-Za-z0-9._~-]|%[0-9A-Fa-f]{2})+", password))
        and not any(ord(char) < 32 or ord(char) == 127 for char in unquote(password, errors="strict"))
        and (insecure_test or bool(re.fullmatch(r"[a-z_][a-z0-9_]{0,62}", database)))
        and parsed.path == f"/{database}"
        and len(pairs) == len(expected_query)
        and dict(pairs) == expected_query
        and not (os.environ.get("PGHOSTADDR") or os.environ.get("PGSERVICE"))
    )


def database_url(variable, role):
    mode = runtime_mode()
    value = os.environ.get(variable, "")
    try:
        parsed = urlsplit(value)
        if mode == "kubero":
            valid = _kubero_database_matches(value, parsed, role)
        elif mode == "supabase":
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
        elif mode == "local-postgres":
            name = os.environ.get("ROOMIES_LOCAL_DATABASE", "roomies_local")
            valid = (bool(re.fullmatch(r"roomies_[a-z0-9_]{1,48}", name)) and
                     parsed.scheme == "postgresql" and parsed.hostname == "127.0.0.1" and
                     parsed.port == 5432 and unquote(parsed.username or "") == role and
                     bool(parsed.password) and parsed.path == "/" + name and
                     not parsed.query and not parsed.fragment)
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
    mode = runtime_mode()
    # Remote destinations come only from these operator-controlled settings.
    upstream_variables = {"AUTH_USERS_UPSTREAM_URL", "LISTADO_UPSTREAM_URL", "MATCH_UPSTREAM_URL", "CONVIVENCIA_UPSTREAM_URL"}
    value = os.environ.get(variable, "")
    try:
        parsed = urlsplit(value)
        port = parsed.port
        local = (parsed.scheme == "http" and
                 parsed.hostname in {"127.0.0.1", "localhost", *docker_hosts} and
                 port is not None and port > 0)
        remote = (mode == "supabase" and variable in upstream_variables and
                  parsed.scheme == "https" and
                  re.fullmatch(r"(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}", parsed.hostname or "") and
                  len(parsed.hostname) <= 253 and (port is None or port > 0))
        valid = ((local or remote) and
                 re.fullmatch(r"[A-Za-z0-9.-]+(?::[0-9]+)?", parsed.netloc) and
                 parsed.username is None and parsed.password is None and
                 parsed.path in {"", "/"} and
                 not any(c.isspace() or ord(c) < 32 or ord(c) == 127 for c in value) and
                 not any(c in value for c in ("\\", "?", "#", "%")))
    except ValueError:
        valid = False
    if not valid:
        raise DependencyUnavailable("El destino del servicio no está configurado o no es válido.")
    return value.rstrip("/")
