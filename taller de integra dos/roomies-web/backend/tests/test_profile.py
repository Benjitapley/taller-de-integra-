from io import BytesIO
from datetime import timedelta
from copy import deepcopy

import pytest
from PIL import Image
from backend.main import main as web
from backend.auth_service import main as auth
from backend.tests.test_auth import verified_login


def png():
    output = BytesIO()
    Image.new("RGB", (4, 4), "purple").save(output, format="PNG")
    return output.getvalue()


def test_profile_edit_is_owned_by_jwt(client, payload, mail, db):
    a = verified_login(client, payload, mail)
    b = verified_login(client, {**payload, "correo": "other@example.com", "nombre": "Cuenta B"}, mail)
    before = client.get("/api/perfil", headers=b).json()
    form = dict(edad="30", ocupacion="Profesional", ciudad="Temuco", breve_descripcion="Hola", sobre_mi="Biografía", id_usuario="2", verificado="false")
    assert client.put("/api/perfil?id_usuario=2", headers=a, data=form).status_code == 200
    after = client.get("/api/perfil", headers=a).json()
    assert after["edad"] == 30 and after["ciudad"] == "Temuco"
    assert after["sobre_mi"] == "Biografía" and after["verificado"] is True
    assert client.get("/api/perfil", headers=b).json() == before
    assert client.put("/api/perfil", headers=a, data={"edad": ""}).status_code == 200
    cleared = client.get("/api/perfil", headers=a).json()
    assert cleared["edad"] == "" and cleared["sobre_mi"] == ""


@pytest.mark.parametrize("form", [{"edad": "21 años"}, {"edad": "121"}, {"edad": "-1"}, {"edad": "9"*5000}, {"ocupacion": "x"*101}, {"ciudad": "x"*101}, {"breve_descripcion": "x"*256}, {"sobre_mi": "x"*5001}])
def test_invalid_fields_do_not_update(client, payload, mail, db, form):
    headers = verified_login(client, payload, mail)
    before = client.get("/api/perfil", headers=headers).json()
    assert client.put("/api/perfil", headers=headers, data=form).status_code == 422
    assert client.get("/api/perfil", headers=headers).json() == before


def test_photo_upload_validation_preservation_and_auth(client, payload, mail, monkeypatch, tmp_path):
    monkeypatch.setattr(web, "IMAGENES", tmp_path)
    headers = verified_login(client, payload, mail)
    assert client.put("/api/perfil", files={"foto": ("a.png", png(), "image/png")}).status_code == 401
    for data, status in [(b"not an image", 422), (b"x"*(5*1024*1024+1), 413)]:
        assert client.put("/api/perfil", headers=headers, files={"foto": ("a.png", data, "image/png")}).status_code == status
    assert list(tmp_path.iterdir()) == []
    assert client.put("/api/perfil", headers=headers, files={"foto": ("../../untrusted.jpg", png(), "image/jpeg")}).status_code == 200
    photo = client.get("/api/perfil", headers=headers).json()["foto_perfil"]
    assert photo.startswith("/imagenes/") and photo.endswith(".png")
    assert len(list(tmp_path.iterdir())) == 1
    assert client.put("/api/perfil", headers=headers, data={"ciudad": "Nueva"}).status_code == 200
    assert client.get("/api/perfil", headers=headers).json()["foto_perfil"] == photo


@pytest.mark.parametrize("image_format,extension,mime", [("JPEG", "jpg", "image/jpeg"), ("PNG", "png", "image/png"), ("WEBP", "webp", "image/webp")])
def test_supported_photos_decode_and_persist(client, payload, mail, monkeypatch, tmp_path, image_format, extension, mime):
    headers = verified_login(client, payload, mail)
    monkeypatch.setattr(web, "IMAGENES", tmp_path)
    output = BytesIO()
    Image.new("RGB", (4, 4), "purple").save(output, format=image_format)
    response = client.put("/api/perfil", headers=headers, files={"foto": (f"photo.{extension}", output.getvalue(), mime)})
    assert response.status_code == 200
    photo = client.get("/api/perfil", headers=headers).json()["foto_perfil"]
    assert photo.endswith("." + extension)
    with Image.open(tmp_path / photo.rsplit("/", 1)[1]) as image:
        image.load()
        assert image.format == image_format


def test_truncated_jpeg_preserves_existing_photo_without_profile_writes(client, payload, mail, monkeypatch, tmp_path):
    headers = verified_login(client, payload, mail)
    monkeypatch.setattr(web, "IMAGENES", tmp_path)
    assert client.put("/api/perfil", headers=headers, data={"ciudad": "Anterior"},
                      files={"foto": ("previous.png", png(), "image/png")}).status_code == 200
    before = client.get("/api/perfil", headers=headers).json()
    files_before = {path.name: path.read_bytes() for path in tmp_path.iterdir()}
    output = BytesIO()
    Image.new("RGB", (32, 32), "purple").save(output, format="JPEG")
    damaged = output.getvalue()[:-2]
    with Image.open(BytesIO(damaged)) as image:
        image.verify()  # This is the case the old validation accepted.
    with Image.open(BytesIO(damaged)) as image, pytest.raises(OSError):
        image.load()

    # Authentication uses its own connection; profile persistence must not start.
    def unexpected_profile_connection():
        pytest.fail("Invalid photo reached profile persistence")
    with monkeypatch.context() as patch:
        patch.setattr(web, "conectar", unexpected_profile_connection)
        response = client.put("/api/perfil", headers=headers, data={"ciudad": "No guardar"},
                              files={"foto": ("truncated.jpg", damaged, "image/jpeg")})
    assert response.status_code == 422
    assert client.get("/api/perfil", headers=headers).json() == before
    assert {path.name: path.read_bytes() for path in tmp_path.iterdir()} == files_before


def test_failed_transaction_removes_new_photo(client, payload, mail, monkeypatch, tmp_path, db):
    headers = verified_login(client, payload, mail)
    monkeypatch.setattr(web, "IMAGENES", tmp_path)
    class FailedCommit:
        def __enter__(self):
            return self
        def execute(self, *args):
            pass
        def __exit__(self, *args):
            raise RuntimeError("synthetic failure")
    monkeypatch.setattr(web, "conectar", FailedCommit)
    response = client.put("/api/perfil", headers=headers, files={"foto": ("photo.png", png(), "image/png")})
    assert response.status_code == 500
    assert list(tmp_path.iterdir()) == []


def test_verified_profile_does_not_require_a_new_code(client, payload, mail, db):
    headers = verified_login(client, payload, mail)
    before = (len(mail), deepcopy(db.codes), deepcopy(db.sessions))
    response = client.get("/api/perfil", headers=headers)
    assert response.json()["verificado"] is True
    assert not {"correo", "codigo", "codigo_hash", "contrasena", "access_token"} & response.json().keys()
    assert client.post("/auth/reenviar-codigo", json={"correo": payload["correo"]}).status_code == 200
    assert (len(mail), db.codes, db.sessions) == before


def test_confirmation_restores_existing_session_without_issuing_another_jwt(client, payload, mail, db, monkeypatch):
    headers = verified_login(client, payload, mail)
    original_sessions = deepcopy(db.sessions)
    # Model a state change after login; do not weaken the private dependency.
    db.users[1]["verificado"] = False
    assert client.get("/api/perfil", headers=headers).status_code == 401
    later = auth.ahora() + timedelta(seconds=61)
    monkeypatch.setattr(auth, "ahora", lambda: later)
    assert client.post("/auth/reenviar-codigo", json={"correo": payload["correo"]}).status_code == 200
    response = client.post("/auth/verificar", json={"correo": payload["correo"], "codigo": mail[-1][2]})
    assert response.status_code == 200
    assert "access_token" not in response.json()
    assert client.get("/api/perfil", headers=headers).json()["verificado"] is True
    assert db.sessions == original_sessions
