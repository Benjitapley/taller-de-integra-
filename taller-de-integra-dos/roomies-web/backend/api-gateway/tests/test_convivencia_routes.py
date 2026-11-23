import asyncio
import httpx
import pytest

from app.config import Settings
from app.main import create_app


def reply(status, *, content=b"", headers=None):
    return httpx.Response(status, stream=httpx.ByteStream(content), headers=headers)


def unexpected(request):
    pytest.fail("No debe llamar al upstream")


def exercise(handler, method="GET", path="/", settings=None, **kwargs):
    async def scenario():
        app = create_app(settings, transport=httpx.MockTransport(handler))
        async with app.router.lifespan_context(app):
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url="http://gateway.test") as client:
                return await client.request(method, path, **kwargs)
    return asyncio.run(scenario())


@pytest.mark.parametrize("path", ["/api/arriendos/mio", "/api/arriendos/7"])
def test_arriendos_use_dedicated_upstream_and_forward_only_public_auth(path):
    def handler(request):
        assert request.url.host == "convivencia.test"
        assert request.url.path == path
        assert request.headers["authorization"] == "Bearer synthetic"
        assert "x-roomies-service" not in request.headers
        return reply(200, content=b'{}', headers={"Content-Type": "application/json"})
    result = exercise(handler, path=path, settings=Settings(local_mode=True, convivencia_upstream="http://convivencia.test"),
                      headers={"Authorization": "Bearer synthetic", "X-Roomies-Service": "must-not-forward"})
    assert result.status_code == 200
    assert result.headers["cache-control"] == "no-store"


@pytest.mark.parametrize("path", ["/internal/incorporaciones", "/api/arriendos/0", "/api/arriendos/-1", "/api/arriendos/otro", "/api/arriendos/7/", "/api/arriendos/%37"])
def test_internal_and_noncanonical_arriendos_paths_are_not_routed(path):
    result = exercise(unexpected, path=path, settings=Settings(local_mode=True, convivencia_upstream="http://convivencia.test"))
    assert result.status_code == 404
    assert result.headers["cache-control"] == "no-store"


def test_arriendos_are_read_only_and_disabled_without_configuration():
    config = Settings(local_mode=True)
    result = exercise(unexpected, path="/api/arriendos/mio", settings=config)
    assert result.status_code == 503
    assert result.headers["cache-control"] == "no-store"
    result = exercise(unexpected, method="POST", path="/api/arriendos/7", settings=config)
    assert result.status_code == 405
    assert result.headers["cache-control"] == "no-store"
    assert exercise(unexpected, method="POST", path="/internal/incorporaciones", settings=config).status_code == 404


def test_convivencia_upstream_environment_and_validation(monkeypatch):
    monkeypatch.setenv("CONVIVENCIA_UPSTREAM_URL", "http://127.0.0.1:8004")
    assert Settings.from_env().convivencia_upstream == "http://127.0.0.1:8004"
    with pytest.raises(ValueError):
        Settings(convivencia_upstream="http://user:password@internal.test")


@pytest.mark.parametrize("status", [401, 403, 404, 503])
def test_arriendos_upstream_errors_also_disable_caching(status):
    result = exercise(lambda request: reply(status, content=b'{}', headers={"Cache-Control": "public"}),
                      path="/api/arriendos/mio", settings=Settings(local_mode=True, convivencia_upstream="http://convivencia.test"))
    assert result.status_code == status
    assert result.headers["cache-control"] == "no-store"
