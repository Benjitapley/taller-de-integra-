"""Arranque PID 1 y health local sin shell ni proxies heredados."""
import json
import os
import sys
import urllib.request


def port():
    try:
        value = int(os.environ.get("PORT", "8000"))
        if not 1 <= value <= 65535:
            raise ValueError()
        return value
    except ValueError:
        raise ValueError("PORT debe ser un entero entre 1 y 65535.") from None


def command():
    return [sys.executable, "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0",
            "--port", str(port()), "--no-access-log", "--no-proxy-headers",
            "--timeout-graceful-shutdown", "5"]


def healthy():
    opener = urllib.request.build_opener(urllib.request.ProxyHandler({}))
    with opener.open(f"http://127.0.0.1:{port()}/health", timeout=2) as response:
        return response.status == 200 and json.loads(response.read(1024)) == {"status": "ok"}


def main():
    try:
        if sys.argv[1:] == ["serve"]:
            args = command()
            os.execv(sys.executable, args)
        elif sys.argv[1:] == ["health"]:
            return 0 if healthy() else 1
        else:
            return 2
    except (ValueError, OSError):
        print("Configuración o comprobación local del contenedor inválida.", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
