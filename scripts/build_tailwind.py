"""Descarga el CLI oficial verificado y compila el CSS local de Tailwind."""

import argparse
import hashlib
import platform
import shutil
import subprocess
import sys
import urllib.request
from pathlib import Path


VERSION = "4.3.3"
SHA256 = "e0e260ce048014e9268f6237ff18f8ccf02cef521cbd0ae04e82c2cdf7aa3955"
ROOT = Path(__file__).resolve().parents[1]
EXECUTABLE = ROOT / ".tools" / f"tailwindcss-{VERSION}-windows-x64.exe"
DOWNLOAD_URL = (
    f"https://github.com/tailwindlabs/tailwindcss/releases/download/v{VERSION}/"
    "tailwindcss-windows-x64.exe"
)


def checksum(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--watch", action="store_true", help="Recompilar al editar HTML o JavaScript")
    parser.add_argument("--minify", action="store_true", help="Comprimir el CSS para producción")
    args = parser.parse_args()

    if platform.system() != "Windows" or platform.machine().lower() not in ("amd64", "x86_64"):
        parser.error("Este script utiliza el compilador oficial para Windows x64.")

    if not EXECUTABLE.is_file():
        EXECUTABLE.parent.mkdir(parents=True, exist_ok=True)
        temporary = EXECUTABLE.with_suffix(".exe.download")
        print(f"Descargando Tailwind CSS {VERSION} desde su repositorio oficial...", flush=True)
        with urllib.request.urlopen(DOWNLOAD_URL, timeout=60) as source, temporary.open("wb") as target:
            shutil.copyfileobj(source, target)
        if checksum(temporary) != SHA256:
            raise RuntimeError("La suma SHA256 del compilador no coincide con la publicación oficial.")
        temporary.replace(EXECUTABLE)

    if checksum(EXECUTABLE) != SHA256:
        raise RuntimeError("La suma SHA256 del compilador local no coincide con la publicación oficial.")

    command = [
        str(EXECUTABLE),
        "--input", str(ROOT / "styles" / "tailwind.input.css"),
        "--output", str(ROOT / "PaginaPrincipal" / "tailwind.css"),
    ]
    if args.minify:
        command.append("--minify")
    if args.watch:
        command.append("--watch")
    subprocess.run(command, cwd=ROOT, check=True)


if __name__ == "__main__":
    try:
        main()
    except (OSError, RuntimeError, subprocess.CalledProcessError) as error:
        print(f"No se pudo compilar Tailwind: {error}", file=sys.stderr)
        sys.exit(1)
