"""Fotos inmutables en perfiles; la credencial permanece en Auth/Users."""
from io import BytesIO
import os
import warnings
import re
from uuid import UUID, uuid4

import httpx
from PIL import Image
from backend.service_runtime.settings import project_ref, runtime_mode, auth_provider_url
from backend.service_runtime.contracts import DependencyUnavailable, RuleViolation

MAX_BYTES = 5_000_000
TYPES = {"JPEG": ("image/jpeg", "jpg"), "PNG": ("image/png", "png"), "WEBP": ("image/webp", "webp")}


def validate(content, mime):
    if len(content) > MAX_BYTES:
        raise RuleViolation("La fotografía supera 5 000 000 bytes.", 413)
    if not content or mime not in {v[0] for v in TYPES.values()}:
        raise RuleViolation("Usa JPEG, PNG o WebP.", 415)
    try:
        with warnings.catch_warnings():
            warnings.simplefilter("error", Image.DecompressionBombWarning)
            with Image.open(BytesIO(content)) as image:
                actual, extension = TYPES[image.format]
                if actual != mime or image.width * image.height > 20_000_000:
                    raise ValueError()
                image.verify()
            with Image.open(BytesIO(content)) as image:
                pixels = 0
                for frame in range(getattr(image, "n_frames", 1)):
                    image.seek(frame)
                    pixels += image.width * image.height
                    if pixels > 20_000_000:
                        raise ValueError()
                    image.load()
        return extension
    except (OSError, ValueError, KeyError, SyntaxError, Image.DecompressionBombError, Image.DecompressionBombWarning):
        raise RuleViolation("Fotografía inválida o demasiado grande.", 415) from None


class ProfileImages:
    def settings(self):
        base = (auth_provider_url() if runtime_mode()=="disposable" else f"https://{project_ref()}.supabase.co") + "/storage/v1"
        key = os.environ.get("ROOMIES_SUPABASE_STORAGE_KEY", "")
        if not key or any(c.isspace() for c in key):
            raise DependencyUnavailable("Falta configurar Storage en Auth/Users.")
        headers = {"apikey": key}
        if not key.startswith("sb_secret_"):
            headers["Authorization"] = "Bearer " + key
        return base, headers

    def upload(self, subject, content, mime):
        extension = validate(content, mime)
        path = f"{UUID(str(subject))}/{uuid4().hex}.{extension}"
        base, headers = self.settings()
        try:
            with httpx.Client(timeout=20, trust_env=False, follow_redirects=False) as client:
                response = client.post(f"{base}/object/perfiles/{path}", content=content,
                    headers={**headers, "Content-Type": mime, "x-upsert": "false"})
            if response.status_code not in (200, 201):
                raise ValueError()
        except (httpx.HTTPError, ValueError):
            raise DependencyUnavailable("No se pudo guardar la fotografía.") from None
        return f"{base}/object/public/perfiles/{path}"

    def delete_new(self, reference):
        base, headers = self.settings()
        prefix = f"{base}/object/public/perfiles/"
        if not reference.startswith(prefix):
            raise ValueError("Referencia ajena a perfiles")
        path = reference[len(prefix):]
        if not re.fullmatch(r"[a-f0-9-]{36}/[a-f0-9]{32}\.(?:png|jpg|webp)",path):
            raise ValueError("Ruta inválida")
        # Solo se compensa el objeto nuevo; nunca se elimina la foto anterior.
        with httpx.Client(timeout=10, trust_env=False, follow_redirects=False) as client:
            response = client.delete(f"{base}/object/perfiles/{path}", headers=headers)
            if response.status_code not in (200, 204, 404):
                raise DependencyUnavailable()


def cleanup_previous():
    from app.infrastructure.persistence.local_users import PostgresUsers
    repository=PostgresUsers()
    storage=ProfileImages()
    base=storage.settings()[0]+"/object/public/perfiles/"
    for row in repository.photo_cleanup():
        reference=row['reference']
        if not reference.startswith(base+str(row['subject'])+'/'):
            # Las referencias /imagenes heredadas permanecen disponibles para TI4.
            repository.photo_cleaned(reference)
            continue
        if not repository.photo_referenced(reference):
            storage.delete_new(reference)
            repository.photo_cleaned(reference)
