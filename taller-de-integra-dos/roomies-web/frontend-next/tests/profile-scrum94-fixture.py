"""Real SCRUM-94 HTTP router with disposable identity, profile and image data."""
import os
import socket
import sys
from io import BytesIO
from dataclasses import replace
from datetime import date
from pathlib import Path
from tempfile import TemporaryDirectory
from uuid import UUID

root = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(root))
sys.path.insert(0, str(root / "backend/services/auth-users-service"))

import uvicorn
from fastapi import FastAPI, Header, HTTPException
from fastapi.staticfiles import StaticFiles
from fastapi.responses import Response
from PIL import Image
from app.api.routes.local_users import identity, router, users
from app.domain.local_users import User
from backend.service_runtime.http import configure


class Profiles:
    def __init__(self):
        self.profiles = {
            UUID(int=index): User(index, UUID(int=index), f"Cuenta {index}", date(2000, 1, 1))
            for index in (1, 2)
        }

    def own(self, subject):
        return self.profiles[subject]

    def update(self, subject, changes):
        self.profiles[subject] = replace(self.own(subject), **changes)
        return self.profiles[subject]


def test_identity(authorization: str | None = Header(default=None)):
    account = {"Bearer fixture.userA.signature": 1, "Bearer fixture.userB.signature": 2}.get(authorization)
    if account is None:
        raise HTTPException(401, "Identidad de prueba requerida.")
    return UUID(int=account), True


with TemporaryDirectory(prefix="roomies-profile-http-") as images:
    os.environ["ROOMIES_IMAGE_DIR"] = images
    application = FastAPI()
    configure(application)
    application.include_router(router)
    application.mount("/imagenes", StaticFiles(directory=images))
    @application.get("/test-image")
    def test_image():
        data = BytesIO()
        Image.new("RGB", (2, 2), "blue").save(data, format="PNG")
        return Response(data.getvalue(), media_type="image/png")

    application.dependency_overrides[identity] = test_identity
    profiles = Profiles()
    application.dependency_overrides[users] = lambda: profiles
    sock = socket.socket()
    sock.bind(("127.0.0.1", 0))
    print(f"http://127.0.0.1:{sock.getsockname()[1]}", flush=True)
    uvicorn.Server(uvicorn.Config(application, log_level="error", access_log=False)).run(sockets=[sock])
