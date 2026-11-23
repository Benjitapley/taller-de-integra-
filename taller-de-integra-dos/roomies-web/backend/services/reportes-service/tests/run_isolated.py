"""Pruebas reales en PostgreSQL efímero; nunca usa DSN, dotenv ni DB del usuario."""
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import tempfile


def main():
    service = Path(__file__).resolve().parents[1]
    configured = os.environ.get("POSTGRES_BIN")
    candidates = [Path(configured)] if configured else []
    found = shutil.which("initdb")
    if found:
        candidates.append(Path(found).parent)
    candidates.extend(sorted(Path("C:/Program Files/PostgreSQL").glob("*/bin"), reverse=True))
    executable = ".exe" if os.name == "nt" else ""
    binaries = next((p for p in candidates if (p / ("initdb" + executable)).is_file()), None)
    if binaries is None:
        raise SystemExit("Falta PostgreSQL local. Define POSTGRES_BIN apuntando a su carpeta bin.")
    keep = {k: v for k, v in os.environ.items() if k.upper() in
            {"SYSTEMROOT", "WINDIR", "TEMP", "TMP", "COMSPEC", "PATH"}}
    os.environ.clear()
    os.environ.update(keep)
    os.environ["PYTEST_DISABLE_PLUGIN_AUTOLOAD"] = "1"
    os.environ["ROOMIES_LOCAL_MODE"] = "1"
    os.environ["ROOMIES_RUNTIME_MODE"] = "disposable"
    os.environ["ROOMIES_INTERNAL_TOKEN"] = "isolated-test-service-key-000000000000"
    sys.path[:0] = [str(service), str(service.parents[2])]
    sys.dont_write_bytecode = True
    with socket.socket() as listener:
        listener.bind(("127.0.0.1", 0))
        port = listener.getsockname()[1]
    creationflags = subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0
    temporary = Path(tempfile.mkdtemp(prefix="roomies-reportes-tests-"))
    data = temporary / "data"

    def command(name, *args):
        try:
            # Windows postmaster can inherit PIPE handles and keep communicate() waiting.
            with (temporary / f"{name}.log").open("ab") as command_log:
                return subprocess.run([str(binaries / (name + executable)), *map(str, args)],
                                      stdin=subprocess.DEVNULL, stdout=command_log, stderr=subprocess.STDOUT,
                                      timeout=40, creationflags=creationflags)
        except subprocess.TimeoutExpired:
            raise SystemExit("BLOQUEADO: PostgreSQL efímero excedió el plazo. Pruebas SQL no completadas.") from None
        except OSError as error:
            if getattr(error, "winerror", None) == 4551:
                raise SystemExit("BLOQUEADO: Windows App Control impide PostgreSQL efímero (WinError 4551). Pruebas SQL no ejecutadas.") from None
            raise SystemExit("No se pudo ejecutar PostgreSQL efímero. Pruebas SQL no ejecutadas.") from None

    started = False
    try:
        result = command("initdb", "-D", data, "-U", "reportes_test_admin", "--encoding=UTF8",
                         "--locale=C", "--auth-local=trust", "--auth-host=trust")
        if result.returncode:
            raise SystemExit("No se pudo inicializar PostgreSQL efímero (sin credenciales reales).")
        with (data / "postgresql.conf").open("a", encoding="utf-8") as stream:
            stream.write(f"\nlisten_addresses = '127.0.0.1'\nport = {port}\nfsync = off\n")
        started = True
        result = command("pg_ctl", "-D", data, "-l", temporary / "postgres.log", "-w", "-t", "15", "start")
        if result.returncode:
            raise SystemExit("No se pudo iniciar PostgreSQL efímero en loopback.")
        import psycopg
        admin = f"postgresql://reportes_test_admin@127.0.0.1:{port}/postgres"
        with psycopg.connect(admin, autocommit=True, connect_timeout=5) as connection:
            connection.execute("CREATE DATABASE roomies_sprint2_disposable")
            connection.execute("CREATE ROLE sql_reportes LOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS")
        os.environ["REPORTES_TEST_ADMIN_DSN"] = admin.rsplit("/", 1)[0] + "/roomies_sprint2_disposable"
        os.environ["REPORTES_DATABASE_URL"] = f"postgresql://sql_reportes@127.0.0.1:{port}/roomies_sprint2_disposable"
        # Ports are injected fakes; accidental external Python sockets fail.
        original_connect, original_resolve = socket.socket.connect, socket.getaddrinfo

        def loopback_connect(sock, address):
            if isinstance(address, tuple) and address[0] in {"127.0.0.1", "::1", "localhost"}:
                return original_connect(sock, address)
            raise AssertionError("Prueba intentó abrir red externa.")

        def loopback_resolve(host, *args, **kwargs):
            if host not in {"127.0.0.1", "::1", "localhost", None}:
                raise AssertionError("Prueba intentó resolver red externa.")
            return original_resolve(host, *args, **kwargs)

        socket.socket.connect = loopback_connect
        socket.getaddrinfo = loopback_resolve
        import pytest
        print("Entorno: PostgreSQL efímero loopback; roles dedicados; puertos HTTP simulados; sin dotenv.")
        return pytest.main([str(service / "tests"), "--rootdir", str(service), "--confcutdir", str(service),
                            "--import-mode=importlib", "-q", "-p", "no:cacheprovider", *sys.argv[1:]])
    finally:
        if started:
            command("pg_ctl", "-D", data, "-m", "immediate", "-w", "-t", "15", "stop")
        # Only the exact mkdtemp directory is removed, after stopping its server.
        if (temporary.parent.resolve() == Path(tempfile.gettempdir()).resolve()
                and temporary.name.startswith("roomies-reportes-tests-")
                and not (data / "postmaster.pid").exists()):
            shutil.rmtree(temporary, ignore_errors=True)


if __name__ == "__main__":
    raise SystemExit(main())
