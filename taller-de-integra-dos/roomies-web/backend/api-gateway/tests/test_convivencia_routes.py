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


@pytest.mark.parametrize("path", ["/api/arriendos/mio", "/api/arriendos/7", "/api/arriendos/7/integrantes?activos=true&cursor=next"])
def test_arriendos_use_dedicated_upstream_and_forward_only_public_auth(path):
    def handler(request):
        assert request.url.host == "convivencia.test"
        assert request.url.path == path.split("?", 1)[0]
        if "?" in path:
            assert request.url.query.decode() == path.split("?", 1)[1]
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


def test_kubero_mode_exposes_e05_without_enabling_disposable_mode(monkeypatch):
    monkeypatch.delenv("ROOMIES_LOCAL_MODE", raising=False)
    monkeypatch.setenv("ROOMIES_RUNTIME_MODE", "kubero")
    monkeypatch.setenv("CONVIVENCIA_UPSTREAM_URL", "https://roomies-convivencia-test.inf.uct.cl")

    def handler(request):
        assert request.url.host == "roomies-convivencia-test.inf.uct.cl"
        assert request.url.path == "/api/arriendos/7/expulsiones"
        assert request.headers["authorization"] == "Bearer synthetic"
        return reply(200, content=b'{}', headers={"Content-Type": "application/json"})

    config = Settings.from_env()
    result = exercise(handler, method="POST", path="/api/arriendos/7/expulsiones", settings=config,
                      headers={"Authorization": "Bearer synthetic"},
                      json={"id_usuario": 2, "motivo": "Prueba", "confirmo": True})
    assert result.status_code == 200
    assert result.headers["cache-control"] == "no-store"
    assert exercise(unexpected, path="/internal/incorporaciones", settings=config).status_code == 404


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


@pytest.mark.parametrize("method,path,query", [
    ("POST", "/api/arriendos/4/expulsiones", b""),
    ("GET", "/api/conversaciones", b""),
    ("GET", "/api/conversaciones/12", b""),
    ("GET", "/api/conversaciones/12/mensajes", b"limite=20&antes=abc"),
    ("POST", "/api/conversaciones/12/mensajes", b""),
])
def test_conversaciones_y_mensajes_se_enrutan_sin_perder_identidad(method, path, query):
    payload = b'{"contenido":"Hola","id_cliente":"c9c989c1-7f6a-48c0-8bab-000000000001"}' if method == "POST" else b""

    def handler(request):
        assert request.url.host == "convivencia.test"
        assert request.url.path == path
        assert request.url.query == query
        assert request.method == method
        assert request.headers["authorization"] == "Bearer account-token"
        assert "x-roomies-service" not in request.headers
        assert request.content == payload
        return reply(200, content=b'{}', headers={"Content-Type": "application/json", "Cache-Control": "public"})

    result = exercise(handler, method=method, path=path + ("?" + query.decode() if query else ""),
                      settings=Settings(local_mode=True, convivencia_upstream="http://convivencia.test"),
                      headers={"Authorization": "Bearer account-token", "X-Roomies-Service": "must-not-forward",
                               **({"Content-Type": "application/json"} if method == "POST" else {})},
                      content=payload if method == "POST" else None)
    assert result.status_code == 200
    assert result.headers["cache-control"] == "no-store"


def test_mensajeria_conserva_denegacion_directa_de_convivencia():
    result = exercise(lambda request: reply(403, content=b'{"detail":"No tienes acceso."}',
                                           headers={"Content-Type": "application/json", "Cache-Control": "public"}),
                      path="/api/conversaciones/12/mensajes", settings=Settings(local_mode=True, convivencia_upstream="http://convivencia.test"),
                      headers={"Authorization": "Bearer account-token"})
    assert result.status_code == 403
    assert result.json() == {"detail": "No tienes acceso."}
    assert result.headers["cache-control"] == "no-store"


@pytest.mark.parametrize("method,path", [
    ("GET", "/api/arriendos/4/tareas"),
    ("POST", "/api/arriendos/4/tareas"),
    ("GET", "/api/arriendos/4/integrantes"),
    ("PATCH", "/api/tareas/17"),
    ("PATCH", "/api/tareas/17/estado"),
])
def test_tareas_se_enrutan_al_mismo_servicio_y_conservan_403(method, path):
    payload = b'{"estado":"Completada"}' if method == "PATCH" else b'{"titulo":"Aseo"}' if method == "POST" else b""

    def handler(request):
        assert request.url.host == "convivencia.test"
        assert request.url.path == path
        assert request.headers["authorization"] == "Bearer account-token"
        assert "x-roomies-service" not in request.headers
        assert request.content == payload
        return reply(403, content=b'{"detail":"Sin acceso."}', headers={"Content-Type": "application/json"})

    result = exercise(handler, method=method, path=path,
                      settings=Settings(local_mode=True, convivencia_upstream="http://convivencia.test"),
                      headers={"Authorization": "Bearer account-token", "X-Roomies-Service": "must-not-forward",
                               **({"Content-Type": "application/json"} if payload else {})},
                      content=payload if payload else None)
    assert result.status_code == 403
    assert result.json() == {"detail": "Sin acceso."}
    assert result.headers["cache-control"] == "no-store"


@pytest.mark.parametrize("method,path",[("POST","/api/arriendos/7/expulsiones"),("GET","/api/arriendos/7/integrantes"),("GET","/api/arriendos/7/tareas"),("POST","/api/arriendos/7/tareas"),("PATCH","/api/tareas/9"),("PATCH","/api/tareas/9/estado")])
def test_e05_retiro_integrantes_y_tareas_en_gateway(method,path):
    body=b'{"id_usuario":2,"motivo":"Incumplimiento","confirmo":true}'
    def handler(request):
        assert request.url.host == "convivencia.test"
        assert request.url.path == path
        assert request.method == method
        assert request.headers["authorization"] == "Bearer synthetic"
        assert "x-roomies-service" not in request.headers
        if method != "GET": assert request.content == body
        return reply(200,content=b'{}',headers={"Cache-Control":"public"})
    response=exercise(handler,method=method,path=path,settings=Settings(local_mode=True,convivencia_upstream="http://convivencia.test"),headers={"Authorization":"Bearer synthetic","X-Roomies-Service":"ignored"},content=body if method!="GET" else None)
    assert response.status_code == 200
    assert response.headers["cache-control"] == "no-store"
