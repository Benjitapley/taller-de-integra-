"""Fotos públicas de perfil con escritura reservada a Auth/Users."""
import os
import re
from uuid import uuid4

import httpx

from backend.service_runtime.contracts import DependencyUnavailable
from backend.service_runtime.images import validate_image
from backend.service_runtime.settings import auth_provider_url

MAX_PHOTO_BYTES = 5_000_000
OBJECT_KEY = r"[0-9a-f-]{36}/[0-9a-f]{32}\.(?:jpg|png|webp)"
MIME_TYPES = {".jpg": "image/jpeg", ".png": "image/png", ".webp": "image/webp"}


class ProfileStorage:
    def __init__(self):
        self.origin = auth_provider_url()
        self.key = os.environ.get("ROOMIES_PROFILE_STORAGE_SECRET_KEY", "")
        if not re.fullmatch(r"sb_secret_[A-Za-z0-9_-]+", self.key):
            raise DependencyUnavailable("Falta la clave de Storage de Auth/Users.")
        self.public_prefix = self.origin + "/storage/v1/object/public/perfiles/"

    def prepare(self, subject, data):
        extension = validate_image(data, MAX_PHOTO_BYTES)
        name = f"{subject}/{uuid4().hex}{extension}"
        return name, self.public_prefix + name, MIME_TYPES[extension]

    def own_key(self, subject, reference):
        name = (reference or "").removeprefix(self.public_prefix)
        if reference and reference.startswith(self.public_prefix) and name.startswith(f"{subject}/") and re.fullmatch(OBJECT_KEY, name):
            return name
        return None

    def request(self, method, path, **kwargs):
        try:
            with httpx.Client(timeout=7, trust_env=False, follow_redirects=False) as client:
                response = client.request(
                    method, self.origin + "/storage/v1/object/" + path,
                    headers={"apikey": self.key, **kwargs.pop("headers", {})}, **kwargs,
                )
                response.raise_for_status()
        except httpx.HTTPError:
            raise DependencyUnavailable("Supabase Storage no está disponible.") from None

    def upload(self, name, content_type, data):
        self.request("POST", f"perfiles/{name}", headers={"Content-Type": content_type}, content=data)

    def delete(self, name):
        if not re.fullmatch(OBJECT_KEY, name):
            raise DependencyUnavailable("Referencia de Storage no válida.")
        self.request("DELETE", "perfiles", json={"prefixes": [name]})
