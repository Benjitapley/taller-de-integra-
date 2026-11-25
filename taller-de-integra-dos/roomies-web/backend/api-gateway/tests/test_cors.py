import asyncio
import json

import httpx
import pytest

from app.config import Settings
from app.main import create_app


ALLOWED_ORIGIN = "http://localhost:8081"


def exercise(handler, method="GET", path="/usuarios/me", *, settings=None, **kwargs):
    async def scenario():
        app = create_app(settings or Settings(upstream="http://auth.test",
                                              cors_origins=(ALLOWED_ORIGIN,)),
                         transport=httpx.MockTransport(handler))
        async with app.router.lifespan_context(app):
            async with httpx.AsyncClient(transport=httpx.ASGITransport(app=app),
                                         base_url="http://gateway.test") as client:
                return await client.request(method, path, **kwargs)
    return asyncio.run(scenario())


def no_upstream(request):
    pytest.fail("La preconsulta CORS no debe llamar al upstream.")


def json_response(status, payload):
    return httpx.Response(status, stream=httpx.ByteStream(json.dumps(payload).encode()),
                          headers={"Content-Type": "application/json"})


@pytest.mark.parametrize("method,path", [
    ("GET", "/usuarios/me"),
    ("PATCH", "/usuarios/me"),
    ("POST", "/local/v1/perfil/inicializacion"),
])
def test_allowed_preflights_are_handled_without_upstream(method, path):
    response = exercise(no_upstream, "OPTIONS", path,
        settings=Settings(local_mode=True, cors_origins=(ALLOWED_ORIGIN,)),
        headers={"Origin": ALLOWED_ORIGIN,
                 "Access-Control-Request-Method": method,
                 "Access-Control-Request-Headers": "authorization,content-type"})

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == ALLOWED_ORIGIN
    assert method in response.headers["access-control-allow-methods"]
    allowed_headers = {value.strip().lower() for value in
                       response.headers["access-control-allow-headers"].split(",")}
    assert {"authorization", "content-type"} <= allowed_headers
    assert response.headers["access-control-max-age"] == "600"
    assert "access-control-allow-credentials" not in response.headers


@pytest.mark.parametrize("method", ["GET", "PATCH"])
def test_profile_requests_preserve_bearer_status_body_and_cors(method):
    def handler(request):
        assert request.method == method
        assert request.headers["authorization"] == "Bearer synthetic.test.token"
        return json_response(200, {"perfil": "ficticio"})

    response = exercise(handler, method, headers={
        "Origin": ALLOWED_ORIGIN,
        "Authorization": "Bearer synthetic.test.token",
        "Content-Type": "application/json",
    })

    assert response.status_code == 200
    assert response.json() == {"perfil": "ficticio"}
    assert response.headers["access-control-allow-origin"] == ALLOWED_ORIGIN


def test_profile_initialization_post_remains_routed_with_cors():
    def handler(request):
        assert request.method == "POST"
        assert request.url.path == "/local/v1/perfil/inicializacion"
        assert request.headers["authorization"] == "Bearer synthetic.test.token"
        assert request.content == b'{"nombre":"Perfil ficticio"}'
        return json_response(201, {"creado": True})

    response = exercise(handler, "POST", "/local/v1/perfil/inicializacion",
        settings=Settings(local_mode=True, upstream="http://auth.test",
                          cors_origins=(ALLOWED_ORIGIN,)),
        headers={"Origin": ALLOWED_ORIGIN,
                 "Authorization": "Bearer synthetic.test.token",
                 "Content-Type": "application/json"},
        content=b'{"nombre":"Perfil ficticio"}')

    assert response.status_code == 201
    assert response.json() == {"creado": True}
    assert response.headers["access-control-allow-origin"] == ALLOWED_ORIGIN


@pytest.mark.parametrize("status", [401, 403, 422, 503])
def test_upstream_errors_keep_status_body_and_cors(status):
    response = exercise(lambda _: json_response(status, {"detail": "ficticio"}),
        headers={"Origin": ALLOWED_ORIGIN})

    assert response.status_code == status
    assert response.json() == {"detail": "ficticio"}
    assert response.headers["access-control-allow-origin"] == ALLOWED_ORIGIN


def test_gateway_errors_have_cors():
    response = exercise(no_upstream, settings=Settings(cors_origins=(ALLOWED_ORIGIN,)),
                        headers={"Origin": ALLOWED_ORIGIN})
    assert response.status_code == 503
    assert response.headers["access-control-allow-origin"] == ALLOWED_ORIGIN

    def connection_failure(request):
        raise httpx.ConnectError("fallo simulado", request=request)

    response = exercise(connection_failure, headers={"Origin": ALLOWED_ORIGIN})
    assert response.status_code == 502
    assert response.headers["access-control-allow-origin"] == ALLOWED_ORIGIN

    def upstream_timeout(request):
        raise httpx.ReadTimeout("timeout simulado", request=request)

    response = exercise(upstream_timeout, headers={"Origin": ALLOWED_ORIGIN})
    assert response.status_code == 504
    assert response.headers["access-control-allow-origin"] == ALLOWED_ORIGIN


def test_unlisted_origin_preflight_is_rejected_without_upstream_or_allow_origin():
    response = exercise(no_upstream, "OPTIONS", headers={
        "Origin": "https://sitio-ajeno.example",
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "authorization",
    })
    assert response.status_code == 400
    assert "access-control-allow-origin" not in response.headers


def test_unlisted_header_preflight_is_rejected_without_upstream():
    response = exercise(no_upstream, "OPTIONS", headers={
        "Origin": ALLOWED_ORIGIN,
        "Access-Control-Request-Method": "GET",
        "Access-Control-Request-Headers": "x-cabecera-no-permitida",
    })
    assert response.status_code == 400


def test_native_request_without_origin_keeps_http_behavior():
    response = exercise(lambda _: json_response(401, {"detail": "sesión requerida"}))
    assert response.status_code == 401
    assert response.json() == {"detail": "sesión requerida"}
    assert "access-control-allow-origin" not in response.headers


def test_local_route_cannot_echo_an_unlisted_origin():
    response = exercise(no_upstream, "GET", "/api/admin/resumen",
        settings=Settings(local_mode=True, cors_origins=(ALLOWED_ORIGIN,)),
        headers={"Origin": "https://sitio-ajeno.example"})
    assert response.status_code == 503
    assert "access-control-allow-origin" not in response.headers


@pytest.mark.parametrize("origin", [
    "*", "ftp://localhost:8081", "http://user@localhost:8081",
    "https://*.example.test",
    "http://localhost:8081/", "http://localhost:8081?x=1",
    "http://localhost:8081#parte", "http://localhost:puerto",
    "http://localhost:8081 con-espacios", "http://localhost:",
])
def test_invalid_cors_origins_are_rejected(origin):
    with pytest.raises(ValueError, match="Configuración CORS inválida"):
        Settings(cors_origins=(origin,))


def test_cors_origins_must_be_strings():
    with pytest.raises(ValueError, match="Configuración CORS inválida"):
        Settings(cors_origins=(None,))


def test_cors_origins_default_to_empty_and_allow_valid_direct_configuration():
    assert Settings().cors_origins == ()
    assert Settings(cors_origins=(ALLOWED_ORIGIN,)).cors_origins == (ALLOWED_ORIGIN,)
