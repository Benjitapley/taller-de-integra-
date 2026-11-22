"""pg_dump remoto de solo lectura + restauración local; archivo cifrado con DPAPI."""
import ctypes
from ctypes import wintypes
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import subprocess
from uuid import uuid4
from urllib.parse import urlsplit
import psycopg
from psycopg import sql
from psycopg.conninfo import conninfo_to_dict

ROOT = Path(__file__).resolve().parents[2]
TABLES = {"usuario": "id_usuario", "publicacion": "id_publicacion", "imagen_publicacion": "id_imagen", "conexion": "id_conexion"}


def dpapi(data, decrypt=False):
    if os.name != "nt": raise RuntimeError("Este respaldo requiere DPAPI del usuario Windows")
    class Blob(ctypes.Structure):
        _fields_ = [("size", wintypes.DWORD), ("data", ctypes.POINTER(ctypes.c_ubyte))]
    buffer = ctypes.create_string_buffer(data)
    source = Blob(len(data), ctypes.cast(buffer, ctypes.POINTER(ctypes.c_ubyte)))
    target = Blob()
    crypt = ctypes.WinDLL("crypt32", use_last_error=True)
    operation = crypt.CryptUnprotectData if decrypt else crypt.CryptProtectData
    operation.argtypes = [ctypes.POINTER(Blob), ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p, ctypes.c_void_p, wintypes.DWORD, ctypes.POINTER(Blob)]
    operation.restype = wintypes.BOOL
    if not operation(ctypes.byref(source), None, None, None, None, 1, ctypes.byref(target)):
        raise RuntimeError("No se pudo proteger/recuperar el respaldo con DPAPI")
    try: return ctypes.string_at(target.data, target.size)
    finally:
        kernel = ctypes.WinDLL("kernel32")
        kernel.LocalFree.argtypes = [ctypes.c_void_p]
        kernel.LocalFree(ctypes.cast(target.data, ctypes.c_void_p))


def fingerprints(connection):
    result = {}
    for table, key in TABLES.items():
        count, digest = connection.execute(sql.SQL("SELECT count(*),md5(COALESCE(string_agg(to_jsonb(t)::text,E'\\n' ORDER BY {}),'')) FROM haycupo.{} t").format(sql.Identifier(key), sql.Identifier(table))).fetchone()
        result[table] = {"count": count, "digest": digest}
    return result


def run_tool(binary, arguments, env):
    result = subprocess.run([str(binary), *arguments], env=env, stdout=subprocess.DEVNULL, stderr=subprocess.PIPE, timeout=120, creationflags=subprocess.CREATE_NO_WINDOW)
    if result.returncode: raise RuntimeError(f"Falló {binary.name}; no se alteró la fuente remota")


def restore_saved(owner, pgbin, fixture, clean, path):
    path = Path(path).resolve()
    if not path.name.endswith(".dump.dpapi"): raise RuntimeError("Selecciona el respaldo cifrado")
    manifest = json.loads(path.with_suffix(".manifest.json").read_text(encoding="utf-8"))
    data = dpapi(path.read_bytes(), decrypt=True)
    if hashlib.sha256(data).hexdigest() != manifest["sha256_plain_archive"]:
        raise RuntimeError("El archivo no coincide con su manifiesto")
    archive = fixture / "recovered.dump"
    archive.write_bytes(data)
    with psycopg.connect(owner) as connection:
        connection.execute(sql.SQL("CREATE TYPE public.estadoconexion AS ENUM ({})").format(sql.SQL(",").join(sql.Literal(label) for label in manifest["enum_labels"])))
    parts = conninfo_to_dict(owner)
    password = parts.pop("password")
    dsn = " ".join(f"{key}={value}" for key,value in parts.items())
    run_tool(pgbin / "pg_restore.exe", ["--dbname=" + dsn,"--no-owner","--no-acl","--exit-on-error",str(archive)], {**clean,"PGPASSWORD":password})
    with psycopg.connect(owner, options="-c timezone=UTC") as connection:
        if fingerprints(connection) != manifest["tables"]:
            raise RuntimeError("Restauración no coincide con el manifiesto")
    print("PASS recuperación desde archivo cifrado persistido: descifrado, SHA-256 y cuatro tablas restauradas localmente",flush=True)


def backup_and_restore(owner, pgbin, fixture, clean, source_env, rootcert=None):
    from dotenv import dotenv_values
    source = dotenv_values(source_env).get("DATABASE_URL", "").replace("postgresql+psycopg://", "postgresql://", 1)
    ref = "erefnpvdjondjpcyjrpb"
    try:
        parsed = urlsplit(source)
        parts = conninfo_to_dict(source)
        direct = parsed.hostname == f"db.{ref}.supabase.co" and parsed.username == "postgres"
        pooled = bool(parsed.hostname and parsed.hostname.endswith(".pooler.supabase.com") and parsed.username == "postgres." + ref)
        if not (direct or pooled) or parsed.path != "/postgres": raise ValueError()
    except Exception:
        raise RuntimeError("La configuración no identifica la fuente Supabase autorizada") from None
    rootcert = str(Path(rootcert).resolve()) if rootcert else "system"
    remote = {**parts, "sslmode": "verify-full", "sslrootcert": rootcert, "connect_timeout": "5"}
    if pooled: remote["port"] = "5432"  # pg_dump usa pooler de sesión, no transaccional.
    archive = fixture / "business-before-stage1.dump"
    env = {**clean, "PGHOST": remote["host"], "PGPORT": remote.get("port", "5432"), "PGUSER": remote["user"], "PGPASSWORD": remote.get("password", ""), "PGSSLMODE": "verify-full", "PGSSLROOTCERT": rootcert, "PGOPTIONS": "-c default_transaction_read_only=on -c timezone=UTC"}
    try:
        with psycopg.connect(**remote, options="-c default_transaction_read_only=on -c timezone=UTC") as connection:
            connection.read_only = True
            assert connection.execute("SHOW transaction_read_only").fetchone()[0] == "on"
            connection.execute("SET LOCAL TIME ZONE 'UTC'")
            before = fingerprints(connection)
            enums = connection.execute("SELECT e.enumlabel FROM pg_enum e JOIN pg_type t ON t.oid=e.enumtypid JOIN pg_namespace n ON n.oid=t.typnamespace WHERE n.nspname='public' AND t.typname='estadoconexion' ORDER BY e.enumsortorder").fetchall()
            acl = connection.execute("SELECT c.relname,c.relacl::text FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='haycupo' AND c.relkind IN ('r','S') ORDER BY c.relname").fetchall()
        run_tool(pgbin / "pg_dump.exe", ["--dbname=postgres", "--schema=haycupo", "--format=custom", "--no-owner", "--no-acl", "--file=" + str(archive)], env)
        with psycopg.connect(owner) as connection:
            connection.execute(sql.SQL("CREATE TYPE public.estadoconexion AS ENUM ({})").format(sql.SQL(",").join(sql.Literal(row[0]) for row in enums)))
        owner_parts = conninfo_to_dict(owner)
        local_env = {**clean, "PGPASSWORD": owner_parts["password"]}
        local_dsn = " ".join(f"{key}={value}" for key, value in owner_parts.items() if key != "password")
        run_tool(pgbin / "pg_restore.exe", ["--dbname=" + local_dsn, "--no-owner", "--no-acl", "--exit-on-error", str(archive)], local_env)
        with psycopg.connect(owner, options="-c timezone=UTC") as connection:
            restored = fingerprints(connection)
        if restored != before: raise RuntimeError("No coinciden los datos restaurados; no hay respaldo validado")
        data = archive.read_bytes()
        encrypted = dpapi(data)
        if dpapi(encrypted, decrypt=True) != data: raise RuntimeError("Falló recuperación del archivo cifrado")
        directory = ROOT / ".roomies-backups"
        directory.mkdir(exist_ok=True)
        prefix = datetime.now(timezone.utc).strftime("pre-stage1-%Y%m%dT%H%M%SZ-") + uuid4().hex[:8]
        output = directory / (prefix + ".dump.dpapi")
        output.write_bytes(encrypted)
        manifest = {"project_ref": ref, "sha256_plain_archive": hashlib.sha256(data).hexdigest(), "verified_restore": True,
                    "scope": "haycupo + public.estadoconexion; no auth/storage backup", "tables": restored,
                    "legacy_acl": acl, "enum_labels": [row[0] for row in enums], "protection": "Windows DPAPI CurrentUser; recovery requires this Windows user profile"}
        output.with_suffix(".manifest.json").write_text(json.dumps(manifest, indent=2), encoding="utf-8")
        print("PASS respaldo REAL de solo lectura: pg_dump, pg_restore local, conteos/huellas iguales y recuperación DPAPI", flush=True)
        print("BACKUP=" + str(output), flush=True)
    except psycopg.Error as error:
        message = str(error).lower()
        reason = next((label for pattern,label in [("certificate", "certificado TLS"), ("password authentication", "credenciales rechazadas"), ("timeout", "timeout de red"), ("could not translate", "resolución DNS"), ("options", "opciones de conexión no admitidas"), ("tenant or user", "tenant/usuario del pooler"), ("refused", "puerto rechazado")] if pattern in message), type(error).__name__)
        raise RuntimeError(f"Respaldo real no verificado: {reason}; no se alteró Supabase") from None
