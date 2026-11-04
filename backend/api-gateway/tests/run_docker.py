"""Smoke Docker local: no construye ni borra imágenes o recursos ajenos."""
import argparse
import json
import os
from pathlib import Path
import shutil
import socket
import subprocess
import time
import urllib.error
import urllib.request
import uuid


def docker_command(executable, *args, timeout=40):
    result = subprocess.run([executable, *args], capture_output=True, text=True, timeout=timeout)
    if result.returncode:
        raise RuntimeError(f"Docker {args[0]} falló: {result.stderr.strip()}")
    return result.stdout.strip()


def available_port(preferred):
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as listener:
        try:
            listener.bind(("127.0.0.1", preferred))
        except OSError:
            listener.bind(("127.0.0.1", 0))
        return listener.getsockname()[1]


def run(executable, image, preferred):
    override = os.environ.get("DOCKER_HOST", "")
    context = docker_command(executable, "context", "show")
    endpoint = docker_command(executable, "context", "inspect", context, "--format", "{{.Endpoints.docker.Host}}")
    if any(value and not value.startswith(("npipe://", "unix://")) for value in (override, endpoint)):
        raise RuntimeError("La prueba exige un motor local por named pipe o socket Unix.")
    # Lectura de un tag propio. No listar/inspeccionar contenedores de otras tareas.
    docker_command(executable, "version", "--format", "{{.Server.Os}}")
    image_id = docker_command(executable, "image", "inspect", image, "--format", "{{.Id}}")
    port = available_port(preferred)
    print(f"Imagen: {image_id}; publicación: 127.0.0.1:{port} -> 8083")
    if port != preferred:
        print(f"Puerto {preferred} ocupado; se utiliza el puerto libre {port}.")
    suffix = uuid.uuid4().hex[:12]
    name, network = f"scrum83-gateway-test-{suffix}", f"scrum83-gateway-net-{suffix}"
    network_id = container_id = None
    label = "roomies.scrum83.local-test=" + suffix
    try:
        network_id = docker_command(executable, "network", "create", "--driver", "bridge",
                                    "--label", label, network)
        container_id = docker_command(executable, "create", "--name", name, "--label", label,
            "--network", network_id, "--publish", f"127.0.0.1:{port}:8083", "--env", "PORT=8083",
            "--read-only", "--cap-drop", "ALL", "--security-opt", "no-new-privileges=true",
            "--pids-limit", "64", "--memory", "128m", "--cpus", "1",
            "--tmpfs", "/tmp:rw,noexec,nosuid,size=8m", image_id)
        docker_command(executable, "start", container_id)
        host_config = json.loads(docker_command(executable, "inspect", "--format", "{{json .HostConfig}}", container_id))
        assert host_config["ReadonlyRootfs"]
        assert host_config["PortBindings"] == {"8083/tcp": [{"HostIp": "127.0.0.1", "HostPort": str(port)}]}
        assert host_config["CapDrop"] == ["ALL"]
        assert "no-new-privileges=true" in host_config["SecurityOpt"]
        network_info = json.loads(docker_command(executable, "network", "inspect", network_id))[0]
        assert set(network_info["Containers"]) == {container_id}
        opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
        deadline = time.monotonic() + 40
        while True:
            state = json.loads(docker_command(executable, "inspect", "--format", "{{json .State}}", container_id))
            if not state["Running"]:
                raise AssertionError("El contenedor terminó antes del health check.")
            if state.get("Health", {}).get("Status") == "healthy":
                break
            if time.monotonic() >= deadline:
                raise AssertionError("El contenedor no alcanzó healthy a tiempo.")
            time.sleep(0.5)

        with opener.open(f"http://127.0.0.1:{port}/health", timeout=3) as response:
            assert response.status == 200 and json.loads(response.read(1024)) == {"status": "ok"}
        try:
            opener.open(f"http://127.0.0.1:{port}/usuarios/me", timeout=3)
        except urllib.error.HTTPError as response:
            with response:
                assert response.code == 503
                assert response.headers["Cache-Control"] == "no-store"
                assert json.loads(response.read(1024)) == {"detail": "Servicio no configurado."}
        else:
            raise AssertionError("Se esperaba 503 sin upstream.")

        identity = docker_command(executable, "exec", container_id, "python", "-c",
            "import os,platform; assert os.getuid()==10001 and os.getgid()==10001; "
            "print('uid=10001 gid=10001 Python='+platform.python_version())")
        docker_command(executable, "exec", container_id, "python", "-m", "pip", "check")
        docker_command(executable, "exec", container_id, "python", "-c",
            "from pathlib import Path; import app.main,sys; "
            "assert not any(n=='backend' or n.startswith('backend.') for n in sys.modules); "
            "assert not Path('/gateway/.venv').exists(); assert not Path('/gateway/.env').exists(); "
            "assert not Path('/gateway/tests').exists(); "
            "unexpected=[str(p.relative_to('/gateway')) for p in Path('/gateway/app').rglob('*') "
            "if p.is_file() and p.suffix!='.py']; assert not unexpected, unexpected")
        print(f"APROBADO: healthy, /health 200, /usuarios/me 503 + no-store, {identity}, pip check y contenido de imagen.")
        docker_command(executable, "stop", "--time", "10", container_id)
        exit_code = docker_command(executable, "inspect", "--format", "{{.State.ExitCode}}", container_id)
        # Uvicorn puede volver a emitir SIGTERM tras cerrar ordenadamente (143).
        assert exit_code in {"0", "143"}, f"Salida no limpia: {exit_code}"
        # Docker envía los logs INFO de Uvicorn a stderr; verificar aparte abajo.
        shutdown = subprocess.run([executable, "logs", container_id], capture_output=True, text=True, timeout=10)
        assert shutdown.returncode == 0 and "Application shutdown complete." in shutdown.stdout + shutdown.stderr
        print(f"APROBADO: cierre ordenado confirmado en logs; código de salida {exit_code}.")
    finally:
        # Solo IDs obtenidos en esta ejecución; sin prune, volúmenes ni borrado de imágenes.
        try:
            if container_id:
                docker_command(executable, "rm", "--force", container_id)
                print("Limpieza: contenedor temporal eliminado.")
        finally:
            if network_id:
                docker_command(executable, "network", "rm", network_id)
                print("Limpieza: red temporal eliminada. Imagen conservada.")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--docker", default=shutil.which("docker"))
    parser.add_argument("--image", default="roomies-api-gateway")
    parser.add_argument("--port", type=int, default=18083)
    args = parser.parse_args()
    if not args.docker or not Path(args.docker).is_file():
        parser.error("Docker CLI no disponible; indicar --docker con su ruta absoluta.")
    run(args.docker, args.image, args.port)
