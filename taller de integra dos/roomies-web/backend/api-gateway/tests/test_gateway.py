import asyncio
import gzip
import logging
import sys

import httpx
import pytest

from app.config import Settings
from app.main import create_app
from app.proxy import bounded_body, BodyTooLarge


def reply(status, *, content=b"", headers=None):
    # Simular un transporte de red: entregar un stream aún sin consumir.
    return httpx.Response(status, stream=httpx.ByteStream(content), headers=headers)


def exercise(handler, method="GET", path="/usuarios/me", settings=None, **kwargs):
    async def scenario():
        transport = httpx.MockTransport(handler)
        app = create_app(settings or Settings(upstream="http://auth.test"), transport=transport)
        async with app.router.lifespan_context(app):
            upstream_client = app.state.client
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),
                                         base_url="http://gateway.test") as client:
                result = await client.request(method, path, **kwargs)
        assert upstream_client.is_closed
        return result
    return asyncio.run(scenario())


def unexpected(request):
    pytest.fail("No debe llamar al upstream")


def test_health_and_unconfigured():
    assert exercise(unexpected, path="/health", settings=Settings()).json() == {"status": "ok"}
    result = exercise(unexpected, settings=Settings())
    assert result.status_code == 503
    assert result.headers["cache-control"] == "no-store"


@pytest.mark.parametrize("method", ["GET", "PATCH"])
def test_forward_bytes_query_bearer(method, caplog):
    caplog.set_level(logging.DEBUG)
    body = b'{invalid-json:\x00\xff}'
    query = b"tag=a&tag=b&empty=&encoded=%2F%25&space=a%20b&plus=a+b&unicode=%C3%B1"
    calls = []

    def handler(request):
        calls.append(request)
        assert request.method == method
        assert request.url.path == "/usuarios/me"
        assert request.url.query == query
        assert request.headers["authorization"] == "Bearer ficticio.ABC_123.xyz"
        assert request.headers["content-type"] == "application/json; charset=utf-8"
        assert request.content == body
        assert request.url.host == "auth.test"
        assert "cookie" not in request.headers
        assert "x-forwarded-host" not in request.headers
        assert "proxy-authorization" not in request.headers
        return reply(200, content=b"ok", headers={"Content-Type": "text/plain"})

    result = exercise(handler, method, "/usuarios/me?" + query.decode(), content=body,
                      headers={"Authorization": "Bearer ficticio.ABC_123.xyz",
                               "Content-Type": "application/json; charset=utf-8",
                               "Cookie": "secret=ficticio", "X-Forwarded-Host": "evil.test",
                               "Proxy-Authorization": "Basic ficticio"})
    assert result.content == b"ok"
    assert len(calls) == 1
    assert "ficticio.ABC_123.xyz" not in caplog.text
    assert "auth.test" not in caplog.text


@pytest.mark.parametrize("status", [200, 204, 401, 403, 422, 503])
@pytest.mark.parametrize("kind", ["application/json", "text/plain"])
def test_response_contract(status, kind):
    body = b"" if status == 204 else (b'{"detail":"ficticio"}' if kind == "application/json" else b"plain\x00\xff")
    result = exercise(lambda _: reply(status, content=body, headers={
        "Content-Type": kind, "WWW-Authenticate": 'Bearer realm="roomies"',
        "Cache-Control": "public", "Set-Cookie": "secret=ficticio",
        "Server": "internal.test", "X-Internal-Host": "internal.test"}))
    assert result.status_code == status
    assert result.content == body
    assert result.headers["content-type"] == kind
    assert result.headers["www-authenticate"] == 'Bearer realm="roomies"'
    assert result.headers["cache-control"] == "no-store"
    for name in ("set-cookie", "server", "x-internal-host"):
        assert name not in result.headers


@pytest.mark.parametrize("failure,status", [(httpx.ConnectTimeout, 504), (httpx.ReadTimeout, 504),
    (httpx.WriteTimeout, 504), (httpx.PoolTimeout, 504), (httpx.ConnectError, 502),
    (httpx.RemoteProtocolError, 502)])
def test_failures_no_retry(failure, status, caplog):
    calls = []
    def handler(request):
        calls.append(request)
        raise failure("http://internal.test token=ficticio", request=request)
    result = exercise(handler, "PATCH", content=b"{}")
    assert result.status_code == status
    assert len(calls) == 1
    assert "internal.test" not in result.text + caplog.text
    assert "token=ficticio" not in result.text + caplog.text
    assert result.headers["cache-control"] == "no-store"


@pytest.mark.parametrize("path", ["/", "/docs", "/openapi.json", "/publicaciones", "/usuarios/me/",
    "/usuarios/otro", "/usuarios/%6de", "/usuarios/me/extra"])
def test_unknown_paths(path):
    assert exercise(unexpected, path=path).status_code == 404


@pytest.mark.parametrize("method", ["POST", "PUT", "DELETE", "HEAD", "OPTIONS"])
def test_disallowed_methods(method):
    result = exercise(unexpected, method)
    assert result.status_code == 405
    assert result.headers["cache-control"] == "no-store"


@pytest.mark.parametrize("status", [301, 302, 307, 308])
def test_redirect_not_followed_or_exposed(status):
    calls = []
    def handler(request):
        calls.append(request)
        return reply(status, headers={"Location": "http://internal.test/private",
                                              "Refresh": "0;url=http://internal.test"})
    result = exercise(handler)
    assert result.status_code == status
    assert len(calls) == 1
    assert "location" not in result.headers
    assert "refresh" not in result.headers
    assert "internal.test" not in result.text


def test_connection_named_headers_filtered():
    def handler(request):
        assert "accept-language" not in request.headers
        return reply(200, content=b"raw", headers={"Connection": "Retry-After",
                                                         "Retry-After": "20"})
    result = exercise(handler, headers={"Connection": "Accept-Language", "Accept-Language": "es"})
    assert "connection" not in result.headers
    assert "retry-after" not in result.headers


@pytest.mark.parametrize("url", ["ftp://auth.test", "http://user:pass@auth.test", "http://auth.test/path",
    "http://auth.test?x=y", "http://auth.test#frag", "http://auth.test:invalid", "http://auth.test\n"])
def test_invalid_upstreams(url):
    with pytest.raises(ValueError, match="Configuración de upstream inválida"):
        Settings(upstream=url)


@pytest.mark.parametrize("value", [0, -1, float("nan"), float("inf"), 121])
def test_invalid_timeouts(value):
    with pytest.raises(ValueError):
        Settings(read_timeout=value)


def test_env_config_sanitized(monkeypatch):
    monkeypatch.setenv("GATEWAY_READ_TIMEOUT", "secret-ficticio")
    with pytest.raises(ValueError) as error:
        Settings.from_env()
    assert "secret-ficticio" not in str(error.value)


def test_import_isolation():
    assert not any(name == "backend" or name.startswith("backend.") for name in sys.modules)
    assert not any(name in sys.modules for name in ("psycopg", "supabase", "sqlalchemy", "jwt"))


def test_client_options_and_timeout():
    async def scenario():
        config = Settings(connect_timeout=1, read_timeout=2, write_timeout=3, pool_timeout=4)
        app = create_app(config, transport=httpx.MockTransport(unexpected))
        async with app.router.lifespan_context(app):
            client = app.state.client
            assert client.follow_redirects is False
            assert client.trust_env is False
            assert client.timeout == httpx.Timeout(connect=1, read=2, write=3, pool=4)
        assert client.is_closed
    asyncio.run(scenario())


def test_compressed_bytes_preserved():
    compressed = gzip.compress(b'{"nombre":"ficticio"}')
    async def scenario():
        app = create_app(Settings(upstream="http://auth.test"), transport=httpx.MockTransport(
            lambda _: reply(200, content=compressed, headers={"Content-Encoding": "gzip",
                                                             "Content-Type": "application/json"})))
        async with app.router.lifespan_context(app):
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url="http://gw.test") as client:
                async with client.stream("GET", "/usuarios/me") as response:
                    raw = b"".join([part async for part in response.aiter_raw()])
                    assert raw == compressed
                    assert response.headers["content-encoding"] == "gzip"
                    assert int(response.headers["content-length"]) == len(raw)
    asyncio.run(scenario())


@pytest.mark.parametrize("failure,status", [(httpx.ReadTimeout, 504), (httpx.ReadError, 502)])
def test_stream_failure_closed(failure, status):
    class FailingStream(httpx.AsyncByteStream):
        closed = False
        async def __aiter__(self):
            yield b"partial"
            raise failure("internal.test ficticio")
        async def aclose(self):
            self.closed = True
    stream = FailingStream()
    result = exercise(lambda _: httpx.Response(200, stream=stream))
    assert result.status_code == status
    assert "partial" not in result.text
    assert stream.closed


def test_no_auth_invented_and_client_reused():
    calls = []
    def handler(request):
        calls.append(request)
        assert "authorization" not in request.headers
        assert "cookie" not in request.headers
        return reply(401, headers={"Set-Cookie": "session=ficticio; Path=/"})
    async def scenario():
        app = create_app(Settings(upstream="http://auth.test"), transport=httpx.MockTransport(handler))
        async with app.router.lifespan_context(app):
            client = app.state.client
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app), base_url="http://gw.test") as browser:
                for method in ("GET", "PATCH"):
                    result = await browser.request(method, "/usuarios/me?url=http://evil.test")
                    assert result.status_code == 401
                    assert app.state.client is client
                    assert not client.is_closed
                    assert not client.cookies
        assert client.is_closed
    asyncio.run(scenario())
    assert len(calls) == 2
    assert all(request.url.host == "auth.test" for request in calls)


async def fragments(parts, delay=0):
    for part in parts:
        if delay:
            await asyncio.sleep(delay)
        yield part


@pytest.mark.parametrize("parts,status", [([b"1234"], 200), ([b"12", b"34"], 200),
    ([b"12345"], 413), ([b"12", b"34", b"5"], 413)])
@pytest.mark.parametrize("length", [None, "1"])
def test_request_byte_limits(parts, status, length):
    calls = []
    def handler(request):
        calls.append(request)
        assert request.content == b"1234"
        return reply(200)
    result = exercise(handler, "PATCH", content=fragments(parts),
                      headers={} if length is None else {"Content-Length": length},
                      settings=Settings(upstream="http://auth.test", max_request_bytes=4))
    assert result.status_code == status
    assert len(calls) == (1 if status == 200 else 0)
    assert result.headers["cache-control"] == "no-store"


@pytest.mark.parametrize("parts,status", [([b"1234"], 200), ([b"12", b"34"], 200),
    ([b"12345"], 502), ([b"12", b"34", b"5"], 502)])
def test_response_byte_limits(parts, status):
    class Stream(httpx.AsyncByteStream):
        closed = False
        async def __aiter__(self):
            async for part in fragments(parts):
                yield part
        async def aclose(self):
            self.closed = True
    stream = Stream()
    result = exercise(lambda _: httpx.Response(200, stream=stream, headers={"Content-Length": "1"}),
                      settings=Settings(upstream="http://auth.test", max_response_bytes=4))
    assert result.status_code == status
    assert stream.closed
    if status == 200:
        assert result.content == b"1234"
        assert result.headers["content-length"] == "4"
    else:
        assert result.json() == {"detail": "Error de comunicación con el servicio."}


def test_bounded_reader_stops_at_first_excess():
    consumed = []
    async def source():
        for part in (b"1234", b"5", b"must-not-read"):
            consumed.append(part)
            yield part
    with pytest.raises(BodyTooLarge):
        asyncio.run(bounded_body(source(), 4))
    assert consumed == [b"1234", b"5"]


@pytest.mark.parametrize("host", ["gateway.test/otro?x=", "gateway.test#frag", "gateway.test"])
@pytest.mark.parametrize("path,status", [("/usuarios/me", 200), ("/usuarios/%6de", 404),
                                         ("/usuarios/me/", 404), ("/otro", 404)])
def test_host_cannot_change_security_path(host, path, status):
    result = exercise(lambda _: reply(200), path=path, headers={"Host": host})
    assert result.status_code == status
    if path != "/otro":
        assert result.headers["cache-control"] == "no-store"


@pytest.mark.parametrize("encoding,status", [(None, 200), ("identity", 200), ("IDENTITY", 200),
    ("gzip", 415), ("br", 415), ("identity, gzip", 415), ("", 415)])
def test_request_encoding(encoding, status):
    body = gzip.compress(b"{}") if encoding == "gzip" else b"{}"
    calls = []
    def handler(request):
        calls.append(request)
        assert request.content == body
        if encoding is not None:
            assert request.headers["content-encoding"] == encoding
        return reply(200)
    result = exercise(handler, "PATCH", content=body,
                      headers={} if encoding is None else {"Content-Encoding": encoding})
    assert result.status_code == status
    assert len(calls) == (1 if status == 200 else 0)
    assert result.headers["cache-control"] == "no-store"


@pytest.mark.parametrize("client_timeout,total_timeout", [(0.04, 1), (1, 0.04)])
def test_continuous_client_fragments_timeout(client_timeout, total_timeout):
    result = exercise(unexpected, "PATCH", content=fragments([b"x"] * 100, 0.01),
                      settings=Settings(upstream="http://auth.test", client_body_timeout=client_timeout,
                                        total_timeout=total_timeout))
    assert result.status_code == 408
    assert result.json() == {"detail": "Tiempo de recepción agotado."}
    assert result.headers["cache-control"] == "no-store"


def test_continuous_upstream_fragments_total_timeout():
    class SlowStream(httpx.AsyncByteStream):
        closed = False
        async def __aiter__(self):
            async for part in fragments([b"x"] * 100, 0.01):
                yield part
        async def aclose(self):
            self.closed = True
    stream = SlowStream()
    calls = []
    def handler(request):
        calls.append(request)
        return httpx.Response(200, stream=stream)
    result = exercise(handler, "PATCH", content=b"{}",
                      settings=Settings(upstream="http://auth.test", total_timeout=0.04))
    assert result.status_code == 504
    assert len(calls) == 1 and stream.closed
    assert result.headers["cache-control"] == "no-store"


@pytest.mark.parametrize("field", ["max_request_bytes", "max_response_bytes"])
@pytest.mark.parametrize("value", [0, -1, 16_777_217, 1.5, True])
def test_invalid_size_settings(field, value):
    with pytest.raises(ValueError):
        Settings(**{field: value})


def test_new_environment_settings(monkeypatch):
    for key, value in {"MAX_REQUEST_BYTES": "64", "MAX_RESPONSE_BYTES": "128",
                       "CLIENT_BODY_TIMEOUT": "2", "TOTAL_TIMEOUT": "4"}.items():
        monkeypatch.setenv("GATEWAY_" + key, value)
    config = Settings.from_env()
    assert (config.max_request_bytes, config.max_response_bytes) == (64, 128)
    assert (config.client_body_timeout, config.total_timeout) == (2, 4)


def test_total_deadline_is_shared_by_reception_and_upstream():
    calls = []
    async def handler(request):
        calls.append(request)
        await asyncio.sleep(0.30)
        return reply(200)
    result = exercise(handler, "PATCH", content=fragments([b"{}"], 0.10),
                      settings=Settings(upstream="http://auth.test", total_timeout=0.30))
    assert result.status_code == 504 and len(calls) == 1


def test_stalled_client_timeout():
    result = exercise(unexpected, "PATCH", content=fragments([b"{}"], 0.2),
                      settings=Settings(upstream="http://auth.test", client_body_timeout=0.02))
    assert result.status_code == 408


def test_connection_cannot_strip_response_encoding_silently():
    result = exercise(lambda _: reply(200, content=gzip.compress(b"{}"), headers={
        "Content-Encoding": "gzip", "Connection": "Content-Encoding"}))
    assert result.status_code == 502
    assert "content-encoding" not in result.headers


def test_duplicate_request_encoding_rejected():
    result = exercise(unexpected, "PATCH", content=b"{}", headers=[
        ("Content-Encoding", "identity"), ("Content-Encoding", "gzip")])
    assert result.status_code == 415


@pytest.mark.parametrize("status", [204, 304])
def test_no_fabricated_length_for_bodyless_status(status):
    result = exercise(lambda _: reply(status, headers={"Content-Length": "100"}))
    assert result.status_code == status
    assert result.content == b""
    assert "content-length" not in result.headers
