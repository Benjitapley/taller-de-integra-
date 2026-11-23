from concurrent.futures import ThreadPoolExecutor
from io import BytesIO
from threading import Barrier
from unittest.mock import Mock
from uuid import uuid4

import pytest
from PIL import Image
from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.routes import router, service
from app.application.images import cleanup_images
from app.application.service import Publications
from app.infrastructure.image_operations import ImageOperations
from app.infrastructure.repository import PostgresPublications
from backend.service_runtime.contracts import DependencyUnavailable, RuleViolation
from backend.service_runtime.http import configure
from backend.service_runtime.security import confirmed_actor


DATA = {"titulo": "Fotos persistidas", "descripcion": "Prueba sintética", "ubicacion": "Temuco", "precio": "999999999999",
        "cupos_totales": "3", "tipo": "Arrendador", "categoria": "ofrezco", "tipo_vivienda": "habitacion",
        "mascota": "no", "id_region": "9", "id_comuna": "9101", "reglas": '["Sin humo"]'}


def image_bytes():
    stream = BytesIO()
    Image.new("RGB", (2, 2), "blue").save(stream, format="PNG")
    return stream.getvalue()


FILES = [(image_bytes(), "image/png")]


class Storage:
    def __init__(self):
        self.objects, self.calls = {}, 0
        self.fail_upload, self.fail_delete, self.barrier = None, False, None

    def upload(self, path, content, mime):
        self.calls += 1
        if self.calls == self.fail_upload: raise DependencyUnavailable()
        self.objects[path] = content
        if self.barrier: self.barrier.wait(timeout=10)
        return "https://storage.example.test/"+path

    def delete(self, path):
        if self.fail_delete: raise DependencyUnavailable()
        self.objects.pop(path, None)


@pytest.fixture
def publications(repository):
    return Publications(repository, Mock(), Storage())


def test_real_journal_replay_ownership_and_retention(publications, repository):
    key = str(uuid4())
    id = publications.save(1, DATA, FILES*5, key=key)
    rows = ImageOperations(repository).images(id)
    assert len(rows) == 5 and [row["orden"] for row in rows] == list(range(5))
    assert all(row["bucket"] == "publicaciones" and row["id_usuario"] == 1 and row["mime"] == "image/png" for row in rows)
    assert len({row["object_path"] for row in rows}) == 5
    after_restart = Publications(PostgresPublications(), Mock(), publications.images)
    assert after_restart.save(1, DATA, FILES*5, key=key) == id
    assert repository.count() == 1 and publications.images.calls == 5
    with pytest.raises(RuleViolation) as error: after_restart.save(1, {**DATA, "titulo": "Otro"}, FILES*5, key=key)
    assert error.value.status == 409
    with pytest.raises(RuleViolation): after_restart.save(2, DATA, FILES, id=id)
    other = publications.save(2, DATA, FILES)
    foreign = ImageOperations(repository).images(other)[0]["id_imagen"]
    with pytest.raises(RuleViolation): publications.save(1, DATA, FILES, id=id, retained=[foreign])
    calls = publications.images.calls
    with pytest.raises(RuleViolation): publications.save(1, DATA, FILES, id=id, retained=[row["id_imagen"] for row in rows])
    assert publications.images.calls == calls
    publications.save(1, DATA, FILES, id=id, retained=[rows[3]["id_imagen"], rows[0]["id_imagen"]])
    kept = ImageOperations(repository).images(id)
    assert [row["id_imagen"] for row in kept[:2]] == [rows[3]["id_imagen"], rows[0]["id_imagen"]]
    assert len(kept) == 3
    publications.close(1, id)
    assert len(ImageOperations(repository).images(id)) == 3
    assert all(row["object_path"] in publications.images.objects for row in kept)


@pytest.mark.parametrize("failure", ["second-upload", "commit"])
def test_real_failure_recovery_does_not_duplicate(publications, repository, admin_connection, monkeypatch, failure):
    storage, key = publications.images, str(uuid4())
    original = repository.create
    if failure == "commit":
        def fail(*args):
            original(*args)
            raise RuntimeError("synthetic database failure")
        monkeypatch.setattr(repository, "create", fail)
    else: storage.fail_upload = 2
    storage.fail_delete = True
    with pytest.raises((RuntimeError, DependencyUnavailable)):
        publications.save(1, DATA, FILES*2, key=key)
    assert repository.count() == 0
    operation = ImageOperations(repository).operation(1, key)
    assert operation["estado"] == "Prepared" and len(operation["plan"]) == 2
    monkeypatch.setattr(repository, "create", original)
    storage.fail_upload, storage.fail_delete = None, False
    admin_connection.execute("UPDATE listado_applications.publication_image_operation SET touched_at=clock_timestamp()-interval '1 hour'")
    cleanup_images(ImageOperations(PostgresPublications()), storage)
    assert not storage.objects
    id = publications.save(1, DATA, FILES*2, key=key)
    assert repository.count() == 1 and len(ImageOperations(repository).images(id)) == 2


def test_real_cleanup_failure_is_durable_after_commit(publications, repository):
    id = publications.save(1, DATA, FILES*2)
    old = ImageOperations(repository).images(id)
    publications.images.fail_delete = True
    publications.save(1, DATA, FILES, id=id, retained=[old[1]["id_imagen"]])
    assert len(ImageOperations(repository).pending_cleanup()) == 1
    assert len(ImageOperations(repository).images(id)) == 2
    publications.images.fail_delete = False
    assert cleanup_images(ImageOperations(PostgresPublications()), publications.images) == 1
    assert not ImageOperations(repository).pending_cleanup()
    assert old[0]["object_path"] not in publications.images.objects


def test_real_concurrent_edits_preserve_winning_references(publications, repository):
    id = publications.save(1, DATA, FILES)
    publications.images.barrier = Barrier(2)
    def edit(index):
        candidate = Publications(PostgresPublications(), Mock(), publications.images)
        try:
            candidate.save(1, {**DATA, "titulo": f"Concurrente {index}"}, FILES, id=id, retained=[])
            return 200
        except RuleViolation as error:
            return error.status
    with ThreadPoolExecutor(max_workers=2) as pool:
        outcomes = list(pool.map(edit, [1, 2]))
    assert sorted(outcomes) == [200, 409]
    current = ImageOperations(repository).images(id)
    assert len(current) == 1
    assert current[0]["object_path"] in publications.images.objects
    assert len(publications.images.objects) == 1


def test_multipart_limits_canonical_response_and_mime(publications, repository):
    app = FastAPI()
    configure(app)
    app.include_router(router)
    app.dependency_overrides[service] = lambda: publications
    app.dependency_overrides[confirmed_actor] = lambda: type("Actor", (), {"user_id": 1})()
    web = TestClient(app)
    def files(count, mime="image/png"):
        return [("imagenes", (f"photo-{index}.png", image_bytes(), mime)) for index in range(count)]
    response = web.post("/api/publicaciones", data=DATA, files=files(5), headers={"Idempotency-Key": str(uuid4())})
    assert response.status_code == 201, response.text
    body = response.json()
    assert body["id_publicacion"] > 0 and len(body["imagenes"]) == 5
    assert web.post("/api/publicaciones", data=DATA, files=files(6)).status_code == 422
    assert web.post("/api/publicaciones", data=DATA, files=files(1, "image/jpeg")).status_code == 415
    assert web.post("/api/publicaciones", data=DATA, files=[("imagenes", ("fake.png", b"fake", "image/png"))]).status_code == 422
    assert web.post("/api/publicaciones", data=DATA, files=[("imagenes", ("large.png", b"x"*5_000_001, "image/png"))]).status_code == 413
    no_mime = b'--image-boundary\r\nContent-Disposition: form-data; name="imagenes"; filename="no-mime.png"\r\n\r\n'+image_bytes()+b'\r\n--image-boundary--\r\n'
    assert web.post("/api/publicaciones", content=no_mime, headers={"Content-Type":"multipart/form-data; boundary=image-boundary"}).status_code == 415
    for invalid in ["null", "{}", "[true]", "[1,1]"]:
        assert web.post("/api/publicaciones", data={**DATA,"imagenes_conservar":invalid}, files=files(1)).status_code == 422
    assert repository.count() == 1


def test_multipart_five_exact_maximum_images_are_accepted(publications, repository):
    app = FastAPI()
    configure(app)
    app.include_router(router)
    app.dependency_overrides[service] = lambda: publications
    app.dependency_overrides[confirmed_actor] = lambda: type("Actor", (), {"user_id": 1})()
    original = image_bytes()
    maximum = original + b"\x00"*(5_000_000-len(original))
    response = TestClient(app).post("/api/publicaciones",data=DATA,
        files=[("imagenes",(f"maximum-{index}.png",maximum,"image/png")) for index in range(5)])
    assert response.status_code == 201, response.text
    assert len(response.json()["imagenes"]) == 5
    assert len(publications.images.objects) == 5
