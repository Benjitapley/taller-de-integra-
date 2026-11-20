from contextlib import contextmanager
from copy import deepcopy
from io import BytesIO
from types import SimpleNamespace
from uuid import uuid4

import httpx
from PIL import Image
import pytest

from app.application.images import cleanup_images, save_publication
from app.infrastructure.storage import MAX_IMAGE_BYTES, SupabasePublicationImages, validate_image
from backend.service_runtime.contracts import DependencyUnavailable, RuleViolation


def image_bytes(format="PNG"):
    output = BytesIO()
    Image.new("RGB", (3, 3), "red").save(output, format=format)
    return output.getvalue()


class Repository:
    def __init__(self):
        self.rows, self.image_rows, self.journal, self.cleanup = {}, {}, {}, set()
        self.sequence = 0
        self.fail_commit = False

    @contextmanager
    def transaction(self):
        before = deepcopy((self.rows, self.image_rows, self.journal, self.cleanup))
        try:
            yield self
            if self.fail_commit:
                raise RuntimeError("synthetic commit failure")
        except Exception:
            self.rows, self.image_rows, self.journal, self.cleanup = before
            raise

    def create(self, owner, data):
        self.sequence += 1
        self.rows[self.sequence] = {**data, "id_publicacion": self.sequence, "id_usuario": owner, "version_imagenes": 0, "estado": "Disponible"}
        return self.sequence

    def publication(self, id, lock=False):
        return self.rows.get(id)

    def update(self, id, data):
        self.rows[id].update(data)


class Operations:
    def __init__(self, repo): self.repo = repo

    @contextmanager
    def lock(self, actor, key, wait=True): yield True

    def operation(self, actor, key): return self.repo.journal.get((actor, key))

    def prepare(self, actor, key, fingerprint, publication, version, plan):
        result = {"id_usuario": actor, "operation_key": key, "fingerprint": fingerprint, "id_publicacion": publication,
                  "base_version": version, "plan": plan, "estado": "Prepared"}
        self.repo.journal[(actor, key)] = result
        return result

    def restart(self, actor, key): self.operation(actor, key)["estado"] = "Prepared"
    def expire(self, actor, key): self.operation(actor, key)["estado"] = "Cleaned"
    def images(self, publication): return sorted(self.repo.image_rows.get(publication, []), key=lambda row: row["orden"])

    def replace(self, publication, owner, retained, new):
        old = self.images(publication)
        removed = [row for row in old if row["id_imagen"] not in retained]
        self.repo.cleanup.update(row["object_path"] for row in removed)
        rows = [{**next(row for row in old if row["id_imagen"] == id), "orden": order} for order, id in enumerate(retained)]
        for order, image in enumerate(new, len(retained)):
            rows.append({**image, "id_imagen": 1000 + self.repo.sequence * 10 + order, "orden": order})
        self.repo.image_rows[publication] = rows
        self.repo.rows[publication]["version_imagenes"] += 1

    def complete(self, actor, key, publication):
        self.operation(actor, key).update(estado="Complete", id_publicacion=publication)

    def referenced(self, path): return any(row["object_path"] == path for images in self.repo.image_rows.values() for row in images)
    def pending_cleanup(self): return [{"object_path": path} for path in self.repo.cleanup]
    def cleaned(self, path): self.repo.cleanup.discard(path)
    def abandoned(self): return [row for row in self.repo.journal.values() if row["estado"] == "Prepared"]


class Storage:
    def __init__(self):
        self.objects, self.uploads, self.deletes = {}, [], []
        self.fail_upload, self.fail_delete, self.on_upload = None, False, None

    def upload(self, path, content, mime):
        self.uploads.append(path)
        if len(self.uploads) == self.fail_upload: raise DependencyUnavailable()
        self.objects[path] = content
        if self.on_upload: self.on_upload()
        return "https://example.test/" + path

    def delete(self, path):
        if self.fail_delete: raise DependencyUnavailable()
        self.deletes.append(path)
        self.objects.pop(path, None)


@pytest.fixture
def state():
    repo, storage = Repository(), Storage()
    def get(id, owner):
        row = repo.publication(id)
        if row is None or row["id_usuario"] != owner: raise RuleViolation("No encontrada", 404)
        return row
    service = SimpleNamespace(repository=repo, images=storage, get=get)
    return service, repo, storage, Operations(repo)


DATA = {"titulo": "Aviso", "tipo": "Arrendador", "cupos_totales": 2}
FILES = [(image_bytes(), "image/png")]


@pytest.mark.parametrize("format,mime", [("PNG", "image/png"), ("JPEG", "image/jpeg"), ("WEBP", "image/webp")])
def test_validates_real_image_bytes(format, mime):
    assert validate_image(image_bytes(format), mime)["mime"] == mime


@pytest.mark.parametrize("content,mime,status", [(b"not image", "image/png", 422), (image_bytes(), "image/jpeg", 415),
    (image_bytes("GIF"), "image/gif", 415), (b"a"*(MAX_IMAGE_BYTES+1), "image/png", 413), (b"", "image/png", 422)],
    ids=["corrupt", "spoofed-mime", "unsupported-type", "too-large", "empty"])
def test_rejects_corruption_spoofing_and_limits(content, mime, status):
    with pytest.raises(RuleViolation) as error: validate_image(content, mime)
    assert error.value.status == status


def test_exact_byte_limit_and_pixel_limit(monkeypatch):
    content = image_bytes()
    assert validate_image(content + b"\x00"*(MAX_IMAGE_BYTES-len(content)), "image/png")["size_bytes"] == MAX_IMAGE_BYTES
    monkeypatch.setattr("app.infrastructure.storage.MAX_IMAGE_PIXELS", 8)
    with pytest.raises(RuleViolation): validate_image(content, "image/png")


def test_create_five_images_replays_across_new_workflow_instance(state):
    service, repo, storage, operations = state
    key = str(uuid4())
    id = save_publication(service, 1, DATA, FILES*5, key=key, operations=operations)
    assert len(repo.image_rows[id]) == 5
    assert len(storage.objects) == 5
    assert save_publication(service, 1, DATA, FILES*5, key=key, operations=Operations(repo)) == id
    assert len(storage.uploads) == 5 and len(repo.rows) == 1
    with pytest.raises(RuleViolation) as error:
        save_publication(service, 1, {**DATA, "titulo": "Distinto"}, FILES*5, key=key, operations=operations)
    assert error.value.status == 409


def test_six_images_no_upload_and_foreign_ids_no_upload(state):
    service, repo, storage, operations = state
    with pytest.raises(RuleViolation): save_publication(service, 1, DATA, FILES*6, operations=operations)
    id = save_publication(service, 1, DATA, FILES, operations=operations)
    before = len(storage.uploads)
    with pytest.raises(RuleViolation): save_publication(service, 1, DATA, FILES, id, [9999], operations=operations)
    with pytest.raises(RuleViolation): save_publication(service, 2, DATA, FILES, id, operations=operations)
    assert len(storage.uploads) == before


def test_retain_add_remove_order_and_cleanup_after_commit_failure(state):
    service, repo, storage, operations = state
    id = save_publication(service, 1, DATA, FILES*2, operations=operations)
    old = deepcopy(repo.image_rows[id])
    storage.fail_delete = True
    save_publication(service, 1, DATA, FILES, id, [old[1]["id_imagen"]], operations=operations)
    assert repo.image_rows[id][0]["object_path"] == old[1]["object_path"]
    assert old[0]["object_path"] in repo.cleanup
    storage.fail_delete = False
    assert cleanup_images(Operations(repo), storage) == 1
    assert old[0]["object_path"] not in storage.objects
    assert all(row["object_path"] in storage.objects for row in repo.image_rows[id])


@pytest.mark.parametrize("failure", ["second-upload", "commit"])
def test_partial_failure_cleanup_and_retry_same_operation(state, failure):
    service, repo, storage, operations = state
    key = str(uuid4())
    storage.fail_upload = 2 if failure == "second-upload" else None
    repo.fail_commit = failure == "commit"
    storage.fail_delete = True
    with pytest.raises((DependencyUnavailable, RuntimeError)):
        save_publication(service, 1, DATA, FILES*2, key=key, operations=operations)
    assert not repo.rows and repo.journal[(1, key)]["estado"] == "Prepared"
    storage.fail_upload, repo.fail_commit, storage.fail_delete = None, False, False
    cleanup_images(Operations(repo), storage)
    assert not storage.objects
    id = save_publication(service, 1, DATA, FILES*2, key=key, operations=Operations(repo))
    assert len(repo.rows) == 1 and len(repo.image_rows[id]) == 2


def test_edit_version_conflict_keeps_winning_images(state):
    service, repo, storage, operations = state
    id = save_publication(service, 1, DATA, FILES, operations=operations)
    winner = deepcopy(repo.image_rows[id])
    def competing_commit(): repo.rows[id]["version_imagenes"] += 1
    storage.on_upload = competing_commit
    with pytest.raises(RuleViolation) as error:
        save_publication(service, 1, DATA, FILES, id, [], operations=operations)
    assert error.value.status == 409
    assert repo.image_rows[id] == winner
    assert winner[0]["object_path"] in storage.objects


def test_storage_fixed_bucket_no_redirects_and_retry_verifies_bytes(monkeypatch):
    monkeypatch.setenv("ROOMIES_SUPABASE_PROJECT_REF", "a"*20)
    monkeypatch.setenv("ROOMIES_SUPABASE_STORAGE_KEY", "synthetic-test-storage-key")
    path = "1/" + "a"*32 + "/0-" + "b"*64 + ".png"
    content = image_bytes()
    requests = []
    def handler(request):
        requests.append(request)
        if request.method == "POST": return httpx.Response(409, json={"error": "Duplicate"})
        if request.method == "GET": return httpx.Response(200, content=content)
        return httpx.Response(200, json=[])
    original = httpx.Client
    def client(**options):
        assert options == {"timeout": 20, "trust_env": False, "follow_redirects": False}
        return original(**options, transport=httpx.MockTransport(handler))
    monkeypatch.setattr(httpx, "Client", client)
    storage = SupabasePublicationImages()
    assert storage.upload(path, content, "image/png").endswith("/publicaciones/"+path)
    storage.delete(path)
    assert all("/publicaciones" in str(request.url) for request in requests)
    with pytest.raises(RuleViolation): storage.delete("../../other-bucket/image.png")


def test_storage_unavailable_normalized_no_secret_leak(monkeypatch):
    monkeypatch.setenv("ROOMIES_SUPABASE_PROJECT_REF", "a"*20)
    monkeypatch.delenv("ROOMIES_SUPABASE_STORAGE_KEY", raising=False)
    path = "1/" + "a"*32 + "/0-" + "b"*64 + ".png"
    with pytest.raises(DependencyUnavailable): SupabasePublicationImages().upload(path, image_bytes(), "image/png")


@pytest.mark.parametrize("key,bearer",[("sb_secret_synthetic-test-key",False),("synthetic-legacy-jwt",True)])
def test_storage_api_key_headers_support_secret_and_legacy_keys(monkeypatch,key,bearer):
    monkeypatch.setenv("ROOMIES_SUPABASE_PROJECT_REF","a"*20)
    monkeypatch.setenv("ROOMIES_SUPABASE_STORAGE_KEY",key)
    _,headers=SupabasePublicationImages().settings()
    assert headers["apikey"]==key
    assert ("Authorization" in headers)==bearer


@pytest.mark.parametrize("body",[None,[],"private upstream response"])
def test_storage_malformed_error_body_stays_dependency_error(monkeypatch,body):
    monkeypatch.setenv("ROOMIES_SUPABASE_PROJECT_REF","a"*20)
    monkeypatch.setenv("ROOMIES_SUPABASE_STORAGE_KEY","synthetic-test-key")
    original=httpx.Client
    monkeypatch.setattr(httpx,"Client",lambda **options:original(**options,
        transport=httpx.MockTransport(lambda _:httpx.Response(400,json=body))))
    path="1/"+"a"*32+"/0-"+"b"*64+".png"
    with pytest.raises(DependencyUnavailable): SupabasePublicationImages().upload(path,image_bytes(),"image/png")
