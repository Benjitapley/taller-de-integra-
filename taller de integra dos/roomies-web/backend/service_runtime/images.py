"""Almacenamiento local validado, compartido como infraestructura, no como dominio."""
from io import BytesIO
from pathlib import Path
from uuid import uuid4
from PIL import Image
from .contracts import RuleViolation, DependencyUnavailable


class Images:
    def __init__(self, directory, prefix):
        self.directory, self.prefix = Path(directory).resolve() if directory else None, prefix

    def save(self, data):
        if not data:
            return None
        if not self.directory:
            raise DependencyUnavailable()
        if len(data) > 5 * 1024 * 1024:
            raise RuleViolation("La imagen supera 5 MB.", 413)
        try:
            with Image.open(BytesIO(data)) as image:
                extension = {"JPEG": ".jpg", "PNG": ".png", "WEBP": ".webp"}[image.format]
                if image.width * image.height > 20_000_000:
                    raise ValueError()
                image.verify()
            with Image.open(BytesIO(data)) as image:
                for frame in range(getattr(image, "n_frames", 1)):
                    image.seek(frame)
                    if image.width * image.height > 20_000_000:
                        raise ValueError()
                    image.load()
        except Exception:
            raise RuleViolation("Usa una imagen JPG, PNG o WEBP válida.") from None
        self.directory.mkdir(parents=True, exist_ok=True)
        name = self.prefix + uuid4().hex + extension
        (self.directory / name).write_bytes(data)
        return "/imagenes/" + name

    def delete(self, reference):
        if reference and self.directory:
            name = reference.removeprefix("/imagenes/")
            if name.startswith(self.prefix) and Path(name).name == name:
                (self.directory / name).unlink(missing_ok=True)
