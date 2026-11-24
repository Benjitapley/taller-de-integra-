import asyncio

import httpx
import pytest

from app.config import Settings
from app.main import create_app


def exercise(handler, path, method="GET", **kwargs):
    async def scenario():
        app = create_app(Settings.from_env(), transport=httpx.MockTransport(handler))
        async with app.router.lifespan_context(app):
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url="http://gateway.test") as client:
                return await client.request(method, path, **kwargs)
    return asyncio.run(scenario())


@pytest.fixture(autouse=True)
def listado(monkeypatch):
    monkeypatch.setenv("ROOMIES_LOCAL_MODE", "1")
    monkeypatch.setenv("LISTADO_UPSTREAM_URL", "http://listado.test")


@pytest.mark.parametrize("path", ["/api/publicaciones/mias?limite=2&cursor=opaque", "/api/regiones", "/api/regiones/9/comunas"])
def test_canonical_routes_and_cursor_reach_listado(path):
    def handler(request):
        assert request.url.host == "listado.test"
        expected_path, _, expected_query = path.partition("?")
        assert request.url.path == expected_path
        assert request.url.query == expected_query.encode()
        return httpx.Response(200, stream=httpx.ByteStream(b'{}'))
    result = exercise(handler, path)
    assert result.status_code == 200
    if "/mias" in path:
        assert result.headers["cache-control"] == "no-store"


@pytest.mark.parametrize("mode,local", [("disposable", "1"), ("supabase", "0"), ("kubero", "0")])
def test_five_maximum_images_preserve_multipart_and_retry_key(monkeypatch, mode, local):
    monkeypatch.setenv("ROOMIES_RUNTIME_MODE", mode)
    monkeypatch.setenv("ROOMIES_LOCAL_MODE", local)
    key = "b1b28203-34f8-43cf-9728-dce365ca3eaa"
    boundary = "roomies-publication-test"
    part = (f"--{boundary}\r\nContent-Disposition: form-data; name=\"imagenes\"; filename=\"photo.jpg\"\r\n"
            "Content-Type: image/jpeg\r\n\r\n").encode()
    body = b"".join(part + b"x" * 5_000_000 + b"\r\n" for _ in range(5)) + f"--{boundary}--\r\n".encode()
    calls = []
    def handler(request):
        calls.append(request)
        assert request.headers["idempotency-key"] == key
        assert request.headers["content-type"] == f"multipart/form-data; boundary={boundary}"
        assert request.content == body
        assert "x-roomies-service" not in request.headers
        return httpx.Response(201, stream=httpx.ByteStream(b'{}'), headers={"Idempotency-Replayed": "true"})
    result = exercise(handler, "/api/publicaciones", "POST", content=body,
                      headers={"Content-Type": f"multipart/form-data; boundary={boundary}", "Idempotency-Key": key,
                               "X-Roomies-Service": "untrusted"})
    assert result.status_code == 201
    assert result.headers["idempotency-replayed"] == "true"
    assert result.headers["cache-control"] == "no-store"
    assert len(calls) == 1


def test_request_and_response_limits_are_independent(monkeypatch):
    monkeypatch.setenv("ROOMIES_RUNTIME_MODE", "kubero")
    monkeypatch.setenv("ROOMIES_LOCAL_MODE", "0")
    settings = Settings.from_env()
    assert settings.max_request_bytes == 26_000_000
    assert settings.max_response_bytes == 6_291_456
    assert Settings(max_request_bytes=32_000_000).max_request_bytes == 32_000_000
    with pytest.raises(ValueError):
        Settings(max_response_bytes=16_777_217)
    monkeypatch.setenv("GATEWAY_MAX_REQUEST_BYTES", "32")
    response = exercise(lambda _: pytest.fail("La carga debe rechazarse antes del upstream."),
                        "/api/publicaciones", "POST", content=b"x" * 33)
    assert response.status_code == 413


def test_occupancy_confirmation_remains_internal():
    def unexpected(request):
        pytest.fail("El Gateway no debe exponer sincronización interna.")
    response = exercise(unexpected, "/internal/publicaciones/7/ocupacion", "PUT",
                        json={"ocupacion": 1, "version_ocupacion": 1},
                        headers={"X-Roomies-Service": "untrusted"})
    assert response.status_code == 404


def test_publication_detail_forwards_authorization_without_caching():
    path = "/api/publicaciones/7/detalle"
    headers = {"Authorization": "Bearer test-session"}

    def handler(request):
        assert request.url.host == "listado.test"
        assert request.url.path == path
        assert request.headers["authorization"] == headers["Authorization"]
        return httpx.Response(200, stream=httpx.ByteStream(b'{"id_propietario":22}'))

    response = exercise(handler, path, headers=headers)
    assert response.status_code == 200
    assert response.json() == {"id_propietario": 22}
    assert response.headers["cache-control"] == "no-store"


def test_upload_preflight_allows_retry_key():
    def unexpected(request):
        pytest.fail("El preflight no debe llamar al upstream.")
    response = exercise(unexpected, "/api/publicaciones", "OPTIONS", headers={
        "Origin": "https://web.example.test",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "content-type,idempotency-key",
    })
    assert response.status_code == 204
    assert response.headers["access-control-allow-origin"] == "https://web.example.test"
    assert "idempotency-key" in response.headers["access-control-allow-headers"].lower()
