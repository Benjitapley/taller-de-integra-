"""Archivos de avisos: rutas propias e inmutables en el bucket publicaciones."""
from hashlib import sha256
from io import BytesIO
import os
import re
import warnings

import httpx
from PIL import Image, UnidentifiedImageError

from backend.service_runtime.contracts import DependencyUnavailable, RuleViolation
from backend.service_runtime.settings import project_ref

MAX_IMAGE_BYTES = 5_000_000
MAX_IMAGE_PIXELS = 20_000_000
FORMATS = {"JPEG": ("image/jpeg", "jpg"), "PNG": ("image/png", "png"), "WEBP": ("image/webp", "webp")}
OBJECT_PATH = re.compile(r"[1-9][0-9]*/[a-f0-9]{32}/[0-4]-[a-f0-9]{64}\.(jpg|png|webp)\Z")


def validate_image(content, declared_type=None):
    if not isinstance(content, bytes) or not content:
        raise RuleViolation("Imagen vacía o inválida.")
    if len(content) > MAX_IMAGE_BYTES:
        raise RuleViolation("La imagen supera 5 000 000 bytes.", 413)
    if declared_type is not None and declared_type not in {value[0] for value in FORMATS.values()}:
        raise RuleViolation("Usa imágenes JPEG, PNG o WebP.", 415)
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(content)) as image:
                if image.format not in FORMATS:
                    raise RuleViolation("Usa imágenes JPEG, PNG o WebP.", 415)
                mime, extension = FORMATS[image.format]
                if declared_type is not None and declared_type != mime:
                    raise RuleViolation("El contenido no corresponde al tipo de imagen.", 415)
                if image.width * image.height > MAX_IMAGE_PIXELS:
                    raise RuleViolation("La imagen supera 20 millones de píxeles.")
                image.verify()
            with Image.open(BytesIO(content)) as image:
                total_pixels = 0
                for frame in range(getattr(image, "n_frames", 1)):
                    image.seek(frame)
                    total_pixels += image.width * image.height
                    if total_pixels > MAX_IMAGE_PIXELS:
                        raise RuleViolation("La imagen supera 20 millones de píxeles decodificados.")
                    image.load()
    except RuleViolation:
        raise
    except (UnidentifiedImageError, OSError, ValueError, SyntaxError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise RuleViolation("La imagen está corrupta o no puede decodificarse.") from None
    return {"mime": mime, "extension": extension, "size_bytes": len(content), "sha256": sha256(content).hexdigest()}


class SupabasePublicationImages:
    bucket = "publicaciones"

    def settings(self):
        base = f"https://{project_ref()}.supabase.co/storage/v1"
        key = os.environ.get("ROOMIES_SUPABASE_STORAGE_KEY", "")
        if not key or any(char in key for char in "\r\n\x00"):
            raise DependencyUnavailable()
        headers = {"apikey": key}
        if not key.startswith("sb_secret_"):
            headers["Authorization"] = "Bearer " + key
        return base, headers

    def url(self, path):
        self.validate_path(path)
        return f"https://{project_ref()}.supabase.co/storage/v1/object/public/{self.bucket}/{path}"

    @staticmethod
    def validate_path(path):
        if not isinstance(path, str) or not OBJECT_PATH.fullmatch(path):
            raise RuleViolation("Ruta de imagen inválida.")

    def upload(self, path, content, mime):
        self.validate_path(path)
        base, headers = self.settings()
        try:
            with httpx.Client(timeout=20, trust_env=False, follow_redirects=False) as client:
                response = client.post(f"{base}/object/{self.bucket}/{path}", content=content,
                                       headers={**headers, "Content-Type": mime, "x-upsert": "false"})
                error_body = response.json() if response.status_code == 400 else None
                duplicate = isinstance(error_body, dict) and error_body.get("error") == "Duplicate"
                if response.status_code == 409 or duplicate:
                    # La ruta contiene el hash y solo el backend escribe; un reintento verifica los bytes.
                    existing = client.get(f"{base}/object/{self.bucket}/{path}", headers=headers)
                    if existing.status_code == 200 and sha256(existing.content).digest() == sha256(content).digest():
                        return self.url(path)
                if response.status_code not in {200, 201}:
                    raise DependencyUnavailable()
        except (httpx.HTTPError, ValueError):
            raise DependencyUnavailable() from None
        return self.url(path)

    def delete(self, path):
        self.validate_path(path)
        base, headers = self.settings()
        try:
            with httpx.Client(timeout=20, trust_env=False, follow_redirects=False) as client:
                response = client.request("DELETE", f"{base}/object/{self.bucket}", json={"prefixes": [path]}, headers=headers)
            if response.status_code not in {200, 204, 404}:
                raise DependencyUnavailable()
        except httpx.HTTPError:
            raise DependencyUnavailable() from None
