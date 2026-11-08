"""Regresiones del port de publicaciones; SQL simulado y JWT real donde importa."""
from collections import deque
from decimal import Decimal
from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from PIL import Image

from backend.auth_service.security import get_current_user
from backend.main import main as web
from backend.publicaciones_service.schemas import preferencias_desde_formulario
from backend.tests.test_auth import verified_login


def formulario(**cambios):
    return dict(titulo="Habitación", categoria="ofrezco", ubicacion="Temuco",
                precio="150000", tipo="Compartida", cupos_totales="2",
                tipo_vivienda="casa", descripcion="Cerca del centro", mascota="no") | cambios


class Cursor:
    rowcount = 1

    def __init__(self, resultado):
        self.resultado = resultado

    def fetchone(self):
        return self.resultado

    def fetchall(self):
        return self.resultado


class Conexion:
    """Resultados explícitos; una consulta extra no puede pasar inadvertida."""
    def __init__(self, resultados, falla_commit=False):
        self.resultados, self.consultas = deque(resultados), []
        self.falla_commit, self.rollback = falla_commit, False

    def __enter__(self):
        return self

    def __exit__(self, tipo, valor, traceback):
        self.rollback = tipo is not None or self.falla_commit
        if self.falla_commit and tipo is None:
            raise RuntimeError("detalle privado del commit")

    def execute(self, sql, parametros=()):
        self.consultas.append((sql, parametros))
        assert self.resultados, "Consulta inesperada: " + sql
        resultado = self.resultados.popleft()
        if isinstance(resultado, Exception):
            raise resultado
        return Cursor(resultado)


@pytest.fixture
def api_sql(monkeypatch, tmp_path):
    monkeypatch.delenv("PUBLICACIONES_MASCOTAS_DETALLE_ENABLED", raising=False)
    monkeypatch.setattr(web, "IMAGENES", tmp_path)
    anteriores = dict(web.app.dependency_overrides)
    web.app.dependency_overrides[get_current_user] = lambda: 1

    def resultados(*filas, falla_commit=False):
        conexion = Conexion(filas, falla_commit)
        monkeypatch.setattr(web, "conectar", lambda: conexion)
        return conexion

    cliente = TestClient(web.app)  # Sin lifespan ni conexiones reales.
    try:
        yield cliente, resultados, tmp_path
    finally:
        cliente.close()
        web.app.dependency_overrides.clear()
        web.app.dependency_overrides.update(anteriores)


def test_preferencias_normaliza_y_conserva_clientes_anteriores():
    datos = preferencias_desde_formulario("si", '["ave","tortuga","ave"]', " Máximo dos. ")
    assert datos.tipos_mascotas_aceptadas == ["ave", "tortuga"]
    assert datos.condiciones_mascotas == "Máximo dos."
    anterior = {"mascota": "si", "tipos_mascotas_aceptadas": ["ave"], "condiciones_mascotas": "Una"}
    assert preferencias_desde_formulario("si", None, None, anterior).condiciones_mascotas == "Una"
    limpio = preferencias_desde_formulario("no", '["ave"]', "Una")
    assert limpio.tipos_mascotas_aceptadas == [] and limpio.condiciones_mascotas is None


@pytest.mark.parametrize("tipos,condiciones", [
    ("[]", None), ('["otro"]', " "), ('["dragon"]', None),
    ("null", None), ('"ave"', None), ("no-json", None), ('["ave"]', "x" * 2001), ('["ave"]', "Una\x00mascota"),
])
def test_preferencias_rechaza_entradas_incompatibles(tipos, condiciones):
    with pytest.raises(ValueError):
        preferencias_desde_formulario("si", tipos, condiciones)


def test_crear_cliente_legacy_no_requiere_columnas_nuevas(api_sql):
    cliente, resultados, _ = api_sql
    conexion = resultados((42,))
    respuesta = cliente.post("/api/publicaciones", data=formulario(mascota="si"))
    assert respuesta.status_code == 201, respuesta.text
    assert respuesta.json() == {"id": 42, "mensaje": "Publicación creada"}
    sql, parametros = conexion.consultas[0]
    assert parametros[0] == 1
    assert "tipos_mascotas_aceptadas" not in sql and "condiciones_mascotas" not in sql


@pytest.mark.parametrize("campo,valor", [
    ("tipos_mascotas_aceptadas", '["ave"]'), ("condiciones_mascotas", "Una mascota"),
])
@pytest.mark.parametrize("metodo,ruta", [("post", "/api/publicaciones"), ("put", "/api/publicaciones/42")])
def test_campos_nuevos_exigen_habilitacion_sin_escribir(api_sql, campo, valor, metodo, ruta):
    cliente, resultados, _ = api_sql
    conexion = resultados()
    respuesta = getattr(cliente, metodo)(ruta, data=formulario(**{campo: valor}))
    assert respuesta.status_code == 503
    assert conexion.consultas == []


def test_habilitado_guarda_especies_y_admite_creacion_legacy(api_sql, monkeypatch):
    cliente, resultados, _ = api_sql
    monkeypatch.setenv("PUBLICACIONES_MASCOTAS_DETALLE_ENABLED", "true")
    conexion = resultados((42,))
    respuesta = cliente.post("/api/publicaciones", data=formulario(
        mascota="si", tipos_mascotas_aceptadas='["ave","ave"]', condiciones_mascotas="Una"))
    assert respuesta.status_code == 201, respuesta.text
    assert conexion.consultas[0][1][-2:] == (["ave"], "Una")
    resultados((43,))
    assert cliente.post("/api/publicaciones", data=formulario(mascota="si")).status_code == 201


@pytest.mark.parametrize("tipos,condiciones", [("[]", ""), ('["otro"]', ""), ("null", ""), ('["dragon"]', "")])
def test_detalles_invalidos_no_llegan_a_persistencia(api_sql, monkeypatch, tipos, condiciones):
    cliente, resultados, _ = api_sql
    monkeypatch.setenv("PUBLICACIONES_MASCOTAS_DETALLE_ENABLED", "true")
    conexion = resultados()
    respuesta = cliente.post("/api/publicaciones", data=formulario(
        mascota="si", tipos_mascotas_aceptadas=tipos, condiciones_mascotas=condiciones))
    assert respuesta.status_code == 422
    assert conexion.consultas == []


def test_editar_conserva_preferencias_y_metadatos_omitidos(api_sql, monkeypatch):
    cliente, resultados, _ = api_sql
    monkeypatch.setenv("PUBLICACIONES_MASCOTAS_DETALLE_ENABLED", "true")
    conexion = resultados(("si", ["tortuga"], "Solo una tortuga"), None)
    datos = formulario(mascota="si")
    del datos["tipo"]
    respuesta = cliente.put("/api/publicaciones/42", data=datos)
    assert respuesta.status_code == 200, respuesta.text
    assert conexion.consultas[0][1] == (42, 1)
    parametros = conexion.consultas[-1][1]
    assert ["tortuga"] in parametros and "Solo una tortuga" in parametros
    assert parametros[-4:] == (None, None, 42, 1)


@pytest.mark.parametrize("cambio", [
    {"titulo": "   "}, {"precio": "-1"}, {"cupos_totales": "0"},
    {"categoria": "venta"}, {"mascota": "quizas"}, {"permitir_comentarios": "quizas"},
])
def test_edicion_invalida_no_modifica_publicacion(api_sql, cambio):
    cliente, resultados, _ = api_sql
    conexion = resultados()
    respuesta = cliente.put("/api/publicaciones/42", data=formulario(**cambio))
    assert respuesta.status_code == 422
    assert conexion.consultas == []


def test_busqueda_comparte_contrato_y_parametriza_filtros(api_sql):
    cliente, resultados, _ = api_sql
    fila = (42, "Habitación", Decimal("150000.50"), "Temuco", 2, "casa", None,
            "ofrezco", "Antigua", "si", "Actual", None, None, "Disponible", "Arrendador")
    conexion = resultados([fila], [fila])
    catalogo = cliente.get("/api/publicaciones")
    texto = "Temuco%_' OR 1=1 --"
    busqueda = cliente.get("/api/publicaciones/buscar", params={
        "consulta": texto, "personas": "2", "tipo": "casa", "mascotas": "si",
        "precio_min": "100000", "precio_max": "200000", "limite": 10, "offset": 20,
    })
    assert catalogo.status_code == busqueda.status_code == 200
    assert catalogo.json() == busqueda.json()
    publicacion = busqueda.json()[0]
    assert publicacion["descripcion"] == "Actual" and publicacion["cupos_disponibles"] == 2
    sql, parametros = conexion.consultas[-1]
    assert texto not in sql and "OR 1=1" not in sql
    assert any("Temuco" in str(p) for p in parametros)
    assert parametros[-2:] == (10, 20)
    assert all("p.tipos_mascotas_aceptadas" not in q for q, _ in conexion.consultas)


@pytest.mark.parametrize("filtros", [{"precio_min": 200, "precio_max": 100}, {"offset": -1}, {"limite": 101}, {"personas": 0}, {"consulta": "Ciudad\x00"}])
def test_busqueda_rechaza_filtros_invalidos_sin_consultar(api_sql, filtros):
    cliente, resultados, _ = api_sql
    conexion = resultados()
    assert cliente.get("/api/publicaciones/buscar", params=filtros).status_code == 422
    assert conexion.consultas == []


@pytest.mark.parametrize("estado,disponibles", [("Disponible", 4), ("Activa", None), ("cerrada", 0), (None, 4)])
def test_cupos_publicos_no_pierden_capacidad_original(api_sql, estado, disponibles):
    cliente, resultados, _ = api_sql
    resultados((estado, 4))
    respuesta = cliente.get("/api/publicaciones/42/cupos")
    assert respuesta.status_code == 200
    assert respuesta.json() == {"id": 42, "estado": estado or "Disponible", "cupos_totales": 4, "cupos_disponibles": disponibles}


def test_cierre_repetido_conserva_capacidad_y_autor(api_sql):
    cliente, resultados, _ = api_sql
    conexion = resultados(("Cerrada", 4), ("Cerrada", 4))
    respuestas = [cliente.patch("/api/publicaciones/42/cerrar") for _ in range(2)]
    assert all(r.status_code == 200 and r.json()["cupos_disponibles"] == 0 for r in respuestas)
    assert all(r.json()["cupos_totales"] == 4 for r in respuestas)
    assert all(parametros == (42, 1) for _, parametros in conexion.consultas)


def test_cierre_exige_jwt_y_rechaza_propietario_ajeno(client, payload, mail, db):
    assert client.patch("/api/publicaciones/42/cerrar").status_code == 401
    client.cookies.set("roomies_id", "1")
    assert client.patch("/api/publicaciones/42/cerrar").status_code == 401
    verified_login(client, payload, mail)
    otra_cuenta = verified_login(client, {**payload, "correo": "otra@example.com"}, mail)
    db.publications[42] = 1
    assert client.patch("/api/publicaciones/42/cerrar", headers=otra_cuenta).status_code == 404
    assert db.publications[42] == 1


@pytest.mark.parametrize("editar", [False, True])
def test_error_de_guardado_revierte_y_retira_imagen_nueva(api_sql, monkeypatch, editar):
    cliente, resultados, carpeta = api_sql
    conexion = (resultados(("no", None, None), None, RuntimeError("detalle privado"))
                if editar else resultados((42,), None, falla_commit=True))
    escritas, escribir = [], web.Path.write_bytes
    def registrar_escritura(ruta, contenido):
        escritas.append(ruta)
        return escribir(ruta, contenido)
    monkeypatch.setattr(web.Path, "write_bytes", registrar_escritura)
    foto = BytesIO()
    Image.new("RGB", (2, 2), "white").save(foto, format="PNG")
    metodo, ruta = (cliente.put, "/api/publicaciones/42") if editar else (cliente.post, "/api/publicaciones")
    respuesta = metodo(ruta, data=formulario(), files={"imagen": ("foto.png", foto.getvalue(), "image/png")})
    assert respuesta.status_code == 500
    assert "detalle privado" not in respuesta.text
    assert len(escritas) == 1 and not conexion.resultados
    assert conexion.rollback and list(carpeta.iterdir()) == []


@pytest.mark.parametrize("habilitado", [False, True])
def test_cliente_legacy_puede_cambiar_mascotas_sin_especies(api_sql, monkeypatch, habilitado):
    cliente, resultados, _ = api_sql
    monkeypatch.setenv("PUBLICACIONES_MASCOTAS_DETALLE_ENABLED", str(habilitado).lower())
    conexion = resultados(("no", [], None), None)
    respuesta = cliente.put("/api/publicaciones/42", data=formulario(mascota="si"))
    assert respuesta.status_code == 200, respuesta.text
    assert conexion.consultas[-1][1][7] == "si"


def test_catalogo_preserva_campos_opcionales_de_publicaciones_antiguas(api_sql):
    cliente, resultados, _ = api_sql
    resultados([(42, None, Decimal("100"), None, 2, None, None,
                 None, None, None, None, [], None, None, None)])
    respuesta = cliente.get("/api/publicaciones")
    assert respuesta.status_code == 200, respuesta.text
    datos = respuesta.json()[0]
    assert datos["titulo"] is None and datos["tipo_vivienda"] is None
    assert datos["estado"] == "Disponible" and datos["cupos_disponibles"] == 2


def test_catalogo_no_anuncia_vacantes_desconocidas_como_capacidad_total(api_sql):
    cliente, resultados, _ = api_sql
    base = (42, "Lugar", Decimal("100"), "Temuco", 2, "casa", None,
            "ofrezco", "Descripción", "no", None, [], None)
    resultados([(*base, "Activa", "Arrendador"), (*base, "Disponible", "Arrendador")])
    respuesta = cliente.get("/api/publicaciones")
    assert respuesta.status_code == 200
    assert [p["estado"] for p in respuesta.json()] == ["Disponible"]


@pytest.mark.parametrize("editar", [False, True])
def test_jpeg_truncado_se_rechaza_sin_persistir(api_sql, editar):
    cliente, resultados, carpeta = api_sql
    conexion = resultados()
    foto = BytesIO()
    Image.new("RGB", (32, 32), "purple").save(foto, format="JPEG")
    metodo, ruta = (cliente.put, "/api/publicaciones/42") if editar else (cliente.post, "/api/publicaciones")
    respuesta = metodo(ruta, data=formulario(), files={"imagen": ("foto.jpg", foto.getvalue()[:-2], "image/jpeg")})
    assert respuesta.status_code == 422
    assert not conexion.consultas and not list(carpeta.iterdir())


def test_detalle_publico_no_expone_identidad_ni_relaja_edicion(api_sql):
    cliente, resultados, _ = api_sql
    fila = ("Lugar", "ofrezco", "casa", "Temuco", 100, 2, "no", "Descripción", [], None, "Disponible", "Arrendador", False, None)
    conexion = resultados(fila, None)
    publico = cliente.get("/api/publicaciones/42/detalle")
    assert publico.status_code == 200 and publico.json()["tipo"] == "Arrendador"
    assert "id_usuario" not in publico.json()
    assert conexion.consultas[0][1] == (42,)
    assert cliente.get("/api/publicaciones/42").status_code == 404
    assert conexion.consultas[1][1] == (42, 1)


def test_aliases_next_conservan_filtros_y_excluyen_cerradas_y_capacidad_cero(api_sql):
    cliente, resultados, _ = api_sql
    conexion = resultados([])
    respuesta = cliente.get("/api/publicaciones", params={"tipo_vivienda":"casa", "mascota":"si", "cupos_min":2})
    assert respuesta.status_code == 200
    sql, parametros = conexion.consultas[0]
    assert "IN ('disponible', 'activa')" in sql and "p.cupos_totales > 0" in sql
    assert "p.tipo_vivienda = %s" in sql and "p.mascota = %s" in sql
    assert "casa" in parametros and "si" in parametros and 2 in parametros
    conexion = resultados()
    assert cliente.get("/api/publicaciones?tipo=casa&tipo_vivienda=habitacion").status_code == 422
    assert not conexion.consultas
