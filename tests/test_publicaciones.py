"""Validación y API con conexiones falsas, sin modificar PostgreSQL."""

import importlib.util
import sys
import types
import unittest
from decimal import Decimal
from io import BytesIO
from pathlib import Path
from unittest.mock import patch

from fastapi import APIRouter
from fastapi.testclient import TestClient
from pydantic import ValidationError
from PIL import Image
from sqlalchemy.dialects import postgresql
from sqlalchemy.schema import CreateTable

from publicaciones_service.main import app as servicio
from publicaciones_service.models import Base, ImagenPublicacion, Publicacion
from publicaciones_service.schemas import PublicacionCrear, preferencias_desde_formulario


class PreferenciasMascotasTests(unittest.TestCase):
    def test_modelos_resuelven_relacion_y_generan_sql_postgresql(self):
        publicacion = Publicacion(titulo="Habitación", tipos_mascotas_aceptadas=["tortuga"])
        imagen = ImagenPublicacion(url="/imagenes/tortuga.webp", publicacion=publicacion)
        self.assertIn(imagen, publicacion.imagenes)
        for tabla in Base.metadata.sorted_tables:
            self.assertTrue(str(CreateTable(tabla).compile(dialect=postgresql.dialect())))

    def test_acepta_aves_y_tortugas_sin_duplicados(self):
        datos = preferencias_desde_formulario("si", '["ave", "tortuga", "ave"]', "  Máximo dos.  ")
        self.assertEqual(datos.tipos_mascotas_aceptadas, ["ave", "tortuga"])
        self.assertEqual(datos.condiciones_mascotas, "Máximo dos.")

    def test_no_acepta_limpia_preferencias(self):
        datos = preferencias_desde_formulario("no", '["perro"]', "Solo pequeños")
        self.assertEqual(datos.tipos_mascotas_aceptadas, [])
        self.assertIsNone(datos.condiciones_mascotas)

    def test_nueva_publicacion_que_acepta_exige_especie(self):
        with self.assertRaisesRegex(ValueError, "Selecciona al menos"):
            preferencias_desde_formulario("si", "[]", "")

    def test_otro_requiere_especificacion(self):
        with self.assertRaisesRegex(ValueError, "qué otro animal"):
            preferencias_desde_formulario("si", '["otro"]', "  ")
        datos = preferencias_desde_formulario("si", '["otro"]', "Hámster")
        self.assertEqual(datos.condiciones_mascotas, "Hámster")

    def test_rechaza_json_y_especies_invalidos(self):
        for entrada in ("ave", "null", '"ave"', "{}", '["dragon"]'):
            with self.subTest(entrada=entrada), self.assertRaises(ValueError):
                preferencias_desde_formulario("si", entrada, None)

    def test_rechaza_condiciones_demasiado_largas(self):
        with self.assertRaises(ValidationError):
            preferencias_desde_formulario("si", '["ave"]', "x" * 2001)

    def test_editar_legacy_sin_cambiar_mascotas(self):
        anterior = {"mascota": "si", "tipos_mascotas_aceptadas": None}
        datos = preferencias_desde_formulario("si", "[]", "", anterior)
        self.assertEqual(datos.tipos_mascotas_aceptadas, [])

    def test_cambiar_condiciones_legacy_exige_especie(self):
        anterior = {"mascota": "si", "tipos_mascotas_aceptadas": []}
        with self.assertRaisesRegex(ValueError, "Selecciona al menos"):
            preferencias_desde_formulario("si", "[]", "Una mascota", anterior)

    def test_cliente_anterior_conserva_preferencias_al_editar(self):
        anterior = {"mascota": "si", "tipos_mascotas_aceptadas": ["tortuga"],
                    "condiciones_mascotas": "Una tortuga"}
        datos = preferencias_desde_formulario("si", None, None, anterior)
        self.assertEqual(datos.tipos_mascotas_aceptadas, ["tortuga"])
        self.assertEqual(datos.condiciones_mascotas, "Una tortuga")

    def test_no_permite_borrar_ultima_especie_si_acepta(self):
        anterior = {"mascota": "si", "tipos_mascotas_aceptadas": ["ave"]}
        with self.assertRaisesRegex(ValueError, "Selecciona al menos"):
            preferencias_desde_formulario("si", "[]", "", anterior)

    def test_modelo_publicacion_valida_precio_y_titulo(self):
        datos = dict(titulo=" Aviso ", descripcion=" Lugar tranquilo ", precio="150000",
                     ubicacion="Temuco", categoria="ofrezco", tipo="Compartida",
                     tipo_vivienda="casa", cupos_totales=1)
        modelo = PublicacionCrear(**datos)
        self.assertEqual(modelo.titulo, "Aviso")
        self.assertEqual(modelo.precio, Decimal("150000"))
        for cambios in ({"precio": "-1"}, {"titulo": "   "}, {"cupos_totales": 0}):
            with self.subTest(cambios=cambios), self.assertRaises(ValidationError):
                PublicacionCrear(**(datos | cambios))


class CursorFalso:
    def __init__(self, resultado):
        self.resultado = resultado

    def fetchone(self):
        return self.resultado

    def fetchall(self):
        return self.resultado


class ConexionFalsa:
    def __init__(self, *resultados):
        self.resultados = iter(resultados)
        self.consultas = []

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def execute(self, sql, parametros=None):
        self.consultas.append((sql, parametros))
        return CursorFalso(next(self.resultados, None))


def cargar_api_sin_servicios_externos():
    conexiones = types.ModuleType("match_conexion_service.routes")
    conexiones.router = APIRouter()
    autenticacion = types.ModuleType("auth_service.main")
    autenticacion.auth_router = APIRouter()
    ruta = Path(__file__).resolve().parents[1] / "main" / "main.py"
    spec = importlib.util.spec_from_file_location("api_publicaciones_bajo_prueba", ruta)
    modulo = importlib.util.module_from_spec(spec)
    with patch.dict(sys.modules, {"match_conexion_service.routes": conexiones,
                                 "auth_service.main": autenticacion}):
        spec.loader.exec_module(modulo)
    return modulo


class ApiPublicacionesTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.api = cargar_api_sin_servicios_externos()
        cls.cliente = TestClient(cls.api.app)

    @classmethod
    def tearDownClass(cls):
        cls.cliente.close()

    def formulario(self, **cambios):
        return dict(titulo="Habitación", categoria="ofrezco", ubicacion="Temuco",
                    precio="150000", tipo="Compartida", cupos_totales="1",
                    tipo_vivienda="casa", descripcion="Cerca del centro", mascota="si",
                    tipos_mascotas_aceptadas='["ave", "tortuga"]',
                    condiciones_mascotas="Máximo dos mascotas") | cambios

    def test_crear_guarda_lista_y_condiciones(self):
        conexion = ConexionFalsa((42,))
        with patch.object(self.api, "conectar", return_value=conexion):
            respuesta = self.cliente.post("/api/publicaciones", data=self.formulario())
        self.assertEqual(respuesta.status_code, 201, respuesta.text)
        self.assertEqual(respuesta.json()["id"], 42)
        self.assertEqual(conexion.consultas[0][1][-2:], (["ave", "tortuga"], "Máximo dos mascotas"))

    def test_crear_sin_especie_es_422_y_no_escribe(self):
        with patch.object(self.api, "conectar") as conectar:
            respuesta = self.cliente.post("/api/publicaciones", data=self.formulario(
                tipos_mascotas_aceptadas="[]"))
        self.assertEqual(respuesta.status_code, 422)
        conectar.assert_not_called()

    def test_crear_normaliza_textos_y_guarda_booleano(self):
        for valor, esperado in (("true", True), ("false", False), ("on", True), ("0", False)):
            with self.subTest(valor=valor):
                conexion = ConexionFalsa((42,))
                with patch.object(self.api, "conectar", return_value=conexion):
                    respuesta = self.cliente.post("/api/publicaciones", data=self.formulario(
                        titulo="  Un lugar  ", ubicacion="  Temuco  ",
                        descripcion="  Cerca del centro  ", permitir_comentarios=valor))
                self.assertEqual(respuesta.status_code, 201, respuesta.text)
                self.assertEqual(respuesta.json(), {"id": 42, "mensaje": "Publicación creada"})
                parametros = conexion.consultas[0][1]
                self.assertEqual(parametros[2:6], (
                    "Un lugar", "Cerca del centro", Decimal("150000"), "Temuco"))
                self.assertIs(parametros[9], esperado)

    def test_crear_rechaza_datos_invalidos_antes_de_conectar_o_escribir_archivos(self):
        casos = (
            {"titulo": "   "}, {"titulo": "x" * 201},
            {"ubicacion": "   "}, {"ubicacion": "x" * 251},
            {"descripcion": "   "}, {"descripcion": "x" * 5001},
            {"categoria": "venta"}, {"tipo": "propietario"},
            {"tipo_vivienda": "oficina"}, {"precio": "-1"},
            {"precio": "1.001"}, {"precio": "1000000000000"},
            {"precio": "NaN"}, {"precio": "Infinity"},
            {"cupos_totales": "0"}, {"cupos_totales": "2147483648"},
            {"cupos_totales": "1.5"}, {"mascota": "tal vez"},
            {"permitir_comentarios": "tal vez"},
        )
        for cambios in casos:
            with self.subTest(cambios=cambios):
                with patch.object(self.api, "conectar") as conectar, \
                        patch.object(Path, "write_bytes") as escribir:
                    respuesta = self.cliente.post("/api/publicaciones", data=self.formulario(**cambios))
                self.assertEqual(respuesta.status_code, 422, respuesta.text)
                conectar.assert_not_called()
                escribir.assert_not_called()

    def test_crear_exige_campos_obligatorios(self):
        for campo in ("titulo", "categoria", "ubicacion", "precio", "tipo",
                      "cupos_totales", "tipo_vivienda", "descripcion"):
            with self.subTest(campo=campo):
                datos = self.formulario()
                del datos[campo]
                with patch.object(self.api, "conectar") as conectar:
                    respuesta = self.cliente.post("/api/publicaciones", data=datos)
                self.assertEqual(respuesta.status_code, 422, respuesta.text)
                conectar.assert_not_called()

    def test_crear_rechaza_imagen_invalida_sin_escrituras(self):
        with patch.object(self.api, "conectar") as conectar, \
                patch.object(Path, "write_bytes") as escribir:
            respuesta = self.cliente.post("/api/publicaciones", data=self.formulario(),
                                          files={"imagen": ("foto.png", b"no es una imagen", "image/png")})
        self.assertEqual(respuesta.status_code, 422, respuesta.text)
        conectar.assert_not_called()
        escribir.assert_not_called()

    def test_crear_error_de_base_de_datos_no_expone_detalles(self):
        with patch.object(self.api, "conectar", side_effect=RuntimeError("detalle privado de PostgreSQL")):
            respuesta = self.cliente.post("/api/publicaciones", data=self.formulario())
        self.assertEqual(respuesta.status_code, 500, respuesta.text)
        self.assertEqual(respuesta.json(), {"detail": "Error al guardar."})

    def test_actualizar_conserva_publicacion_legacy(self):
        conexion = ConexionFalsa(("si", None, None), None)
        with patch.object(self.api, "conectar", return_value=conexion):
            respuesta = self.cliente.put("/api/publicaciones/42", data=self.formulario(
                tipos_mascotas_aceptadas="[]", condiciones_mascotas=""))
        self.assertEqual(respuesta.status_code, 200, respuesta.text)
        self.assertEqual(conexion.consultas[0][1], (42, 1))
        self.assertEqual(conexion.consultas[-1][1][9:11], ([], None))

    def test_actualizar_a_no_acepta_limpia_datos(self):
        conexion = ConexionFalsa(("si", ["ave"], "Solo una"), None)
        with patch.object(self.api, "conectar", return_value=conexion):
            respuesta = self.cliente.put("/api/publicaciones/42", data=self.formulario(mascota="no"))
        self.assertEqual(respuesta.status_code, 200, respuesta.text)
        parametros = conexion.consultas[-1][1]
        self.assertEqual(parametros[7], "no")
        self.assertEqual(parametros[9:11], ([], None))

    def test_actualizar_invalido_no_escribe_y_conserva_422(self):
        conexion = ConexionFalsa(("si", ["ave"], None))
        with patch.object(self.api, "conectar", return_value=conexion):
            respuesta = self.cliente.put("/api/publicaciones/42", data=self.formulario(
                tipos_mascotas_aceptadas="[]", condiciones_mascotas=""))
        self.assertEqual(respuesta.status_code, 422, respuesta.text)
        self.assertEqual(len(conexion.consultas), 1)

    def test_actualizar_inexistente_o_ajena_es_404(self):
        conexion = ConexionFalsa(None)
        with patch.object(self.api, "conectar", return_value=conexion):
            respuesta = self.cliente.put("/api/publicaciones/42", data=self.formulario())
        self.assertEqual(respuesta.status_code, 404, respuesta.text)
        self.assertEqual(len(conexion.consultas), 1)

    def test_detalle_devuelve_preferencias(self):
        fila = ("Habitación", "ofrezco", "casa", "Temuco", Decimal("150000"),
                1, "si", "Cerca del centro", ["ave", "tortuga"], "Máximo dos",
                "Disponible", "Arrendador", True, "/imagenes/actual.png")
        with patch.object(self.api, "conectar", return_value=ConexionFalsa(fila)):
            respuesta = self.cliente.get("/api/publicaciones/42")
        self.assertEqual(respuesta.status_code, 200, respuesta.text)
        self.assertEqual(respuesta.json()["tipos_mascotas_aceptadas"], ["ave", "tortuga"])
        self.assertEqual(respuesta.json()["condiciones_mascotas"], "Máximo dos")
        self.assertEqual(respuesta.json()["tipo"], "Arrendador")
        self.assertIs(respuesta.json()["permitir_comentarios"], True)
        self.assertEqual(respuesta.json()["imagen"], "/imagenes/actual.png")
        self.assertEqual(respuesta.json()["cupos_disponibles"], 1)

    def test_listado_legacy_devuelve_lista_vacia(self):
        fila = (42, "Habitación", Decimal("150000"), "Temuco", 1, "casa", None,
                "ofrezco", "Descripción", "si", None, None, None, "Disponible")
        with patch.object(self.api, "conectar", return_value=ConexionFalsa([fila])):
            respuesta = self.cliente.get("/api/publicaciones")
        self.assertEqual(respuesta.status_code, 200, respuesta.text)
        self.assertEqual(respuesta.json()[0]["tipos_mascotas_aceptadas"], [])

    def test_listar_y_buscar_devuelven_mismo_formato_y_descripcion_compatible(self):
        filas = [
            (42, "Habitación", Decimal("150000.50"), "Temuco", 3, "casa", "/imagenes/casa.png",
             "ofrezco", "Descripción antigua", "si", "Descripción actual", ["ave"], "Solo una", "Disponible"),
            (41, "Departamento", Decimal("0"), "Valdivia", 1, "departamento", None,
             "busco", "Descripción antigua", "no", None, None, None, "Activa"),
        ]
        esperado = [
            {"id": 42, "titulo": "Habitación", "precio": 150000.5, "ubicacion": "Temuco",
             "cupos_totales": 3, "tipo_vivienda": "casa", "imagen": "/imagenes/casa.png",
             "categoria": "ofrezco", "descripcion": "Descripción actual", "mascota": "si",
             "tipos_mascotas_aceptadas": ["ave"], "condiciones_mascotas": "Solo una",
             "estado": "Disponible", "cupos_disponibles": 3},
            {"id": 41, "titulo": "Departamento", "precio": 0.0, "ubicacion": "Valdivia",
             "cupos_totales": 1, "tipo_vivienda": "departamento", "imagen": None,
             "categoria": "busco", "descripcion": "Descripción antigua", "mascota": "no",
             "tipos_mascotas_aceptadas": [], "condiciones_mascotas": None,
             "estado": "Activa", "cupos_disponibles": 1},
        ]
        for ruta in ("/api/publicaciones", "/api/publicaciones/buscar"):
            with self.subTest(ruta=ruta):
                with patch.object(self.api, "conectar", return_value=ConexionFalsa(filas)):
                    respuesta = self.cliente.get(ruta)
                self.assertEqual(respuesta.status_code, 200, respuesta.text)
                self.assertEqual(respuesta.json(), esperado)

    def test_listado_sin_filtros_no_limita_y_selecciona_una_portada_ordenada(self):
        conexion = ConexionFalsa([])
        with patch.object(self.api, "conectar", return_value=conexion):
            respuesta = self.cliente.get("/api/publicaciones")
        self.assertEqual(respuesta.status_code, 200, respuesta.text)
        self.assertEqual(respuesta.json(), [])
        self.assertEqual(len(conexion.consultas), 1)
        sql, parametros = conexion.consultas[0]
        sql = " ".join(sql.split())
        self.assertIn("ORDER BY i.orden, i.id_imagen LIMIT 1", sql)
        self.assertNotIn("JOIN", sql)
        self.assertNotIn("LIMIT %s", sql)
        self.assertIn("WHERE LOWER(COALESCE(p.estado, 'Disponible')) <> 'cerrada'", sql)
        self.assertTrue(sql.endswith("ORDER BY p.id_publicacion DESC OFFSET %s"))
        self.assertEqual(parametros, (0,))

    def test_buscar_combina_filtros_y_parametriza_texto_literal(self):
        consulta = "  Temuco%_\\' OR 1=1 --  "
        conexion = ConexionFalsa([])
        with patch.object(self.api, "conectar", return_value=conexion):
            respuesta = self.cliente.get("/api/publicaciones/buscar", params={
                "consulta": consulta, "personas": "3", "tipo": "habitacion",
                "mascotas": "si", "precio_min": "100000.25", "precio_max": "200000.50",
                "categoria": "ofrezco", "limite": 15, "offset": 30,
            })
        self.assertEqual(respuesta.status_code, 200, respuesta.text)
        self.assertEqual(respuesta.json(), [])
        self.assertEqual(len(conexion.consultas), 1)
        sql, parametros = conexion.consultas[0]
        sql = " ".join(sql.split())
        self.assertIn("WHERE LOWER(COALESCE(p.estado, 'Disponible')) <> 'cerrada' AND p.ubicacion ILIKE %s AND p.cupos_totales >= %s "
                      "AND p.tipo_vivienda = %s AND p.mascota = %s "
                      "AND p.precio >= %s AND p.precio <= %s AND p.categoria = %s", sql)
        self.assertTrue(sql.endswith("ORDER BY p.id_publicacion DESC LIMIT %s OFFSET %s"))
        self.assertNotIn("Temuco", sql)
        self.assertNotIn("OR 1=1", sql)
        self.assertEqual(parametros, (
            "%Temuco\\%\\_\\\\' OR 1=1 --%", 3, "habitacion", "si",
            Decimal("100000.25"), Decimal("200000.50"), "ofrezco", 15, 30,
        ))

    def test_buscar_uno_o_dos_cupos_exactos(self):
        for cantidad in (1, 2):
            with self.subTest(cantidad=cantidad):
                conexion = ConexionFalsa([])
                with patch.object(self.api, "conectar", return_value=conexion):
                    respuesta = self.cliente.get("/api/publicaciones/buscar", params={"personas": cantidad})
                self.assertEqual(respuesta.status_code, 200, respuesta.text)
                sql, parametros = conexion.consultas[0]
                self.assertIn("p.cupos_totales = %s", sql)
                self.assertEqual(parametros, (cantidad, 0))

    def test_consulta_en_blanco_no_agrega_filtro(self):
        conexion = ConexionFalsa([])
        with patch.object(self.api, "conectar", return_value=conexion):
            respuesta = self.cliente.get("/api/publicaciones/buscar", params={"consulta": "   "})
        self.assertEqual(respuesta.status_code, 200, respuesta.text)
        sql, parametros = conexion.consultas[0]
        self.assertNotIn("ILIKE", sql)
        self.assertEqual(parametros, (0,))

    def test_listar_y_buscar_rechazan_filtros_invalidos_sin_conectar(self):
        casos = (
            {"consulta": "x" * 251}, {"personas": "0"}, {"personas": "4"},
            {"tipo": "oficina"}, {"mascotas": "tal vez"}, {"categoria": "venta"},
            {"precio_min": "-1"}, {"precio_max": "-1"}, {"precio_min": "1.001"},
            {"precio_max": "1000000000000"}, {"precio_min": "NaN"},
            {"precio_max": "Infinity"}, {"precio_min": "200", "precio_max": "100"},
            {"limite": "0"}, {"limite": "101"}, {"limite": "muchos"},
            {"offset": "-1"}, {"offset": "1.5"}, {"offset": "9223372036854775808"},
        )
        for ruta in ("/api/publicaciones", "/api/publicaciones/buscar"):
            for filtros in casos:
                with self.subTest(ruta=ruta, filtros=filtros):
                    with patch.object(self.api, "conectar") as conectar:
                        respuesta = self.cliente.get(ruta, params=filtros)
                    self.assertEqual(respuesta.status_code, 422, respuesta.text)
                    conectar.assert_not_called()

    def test_listar_y_buscar_no_exponen_errores_de_base_de_datos(self):
        for ruta in ("/api/publicaciones", "/api/publicaciones/buscar"):
            with self.subTest(ruta=ruta):
                with patch.object(self.api, "conectar", side_effect=RuntimeError("detalle privado de PostgreSQL")):
                    respuesta = self.cliente.get(ruta)
                self.assertEqual(respuesta.status_code, 500, respuesta.text)
                self.assertEqual(respuesta.json(), {"detail": "Error al cargar publicaciones"})

    def test_actualizar_valida_todos_los_campos_antes_de_conectar(self):
        casos = (
            {"titulo": "   "}, {"titulo": "x" * 201}, {"ubicacion": "   "},
            {"ubicacion": "x" * 251}, {"descripcion": "   "}, {"descripcion": "x" * 5001},
            {"categoria": "venta"}, {"tipo": "propietario"}, {"tipo_vivienda": "oficina"},
            {"precio": "-1"}, {"precio": "1.001"}, {"precio": "NaN"},
            {"precio": "Infinity"}, {"precio": "1000000000000"},
            {"cupos_totales": "0"}, {"cupos_totales": "1.5"}, {"cupos_totales": "2147483648"},
            {"permitir_comentarios": "tal vez"},
        )
        for cambios in casos:
            with self.subTest(cambios=cambios):
                with patch.object(self.api, "conectar") as conectar, patch.object(Path, "write_bytes") as escribir:
                    respuesta = self.cliente.put("/api/publicaciones/42", data=self.formulario(**cambios))
                self.assertEqual(respuesta.status_code, 422, respuesta.text)
                conectar.assert_not_called()
                escribir.assert_not_called()

    def test_actualizar_normaliza_y_conserva_metadatos_si_se_omiten(self):
        datos = self.formulario(titulo=" Aviso ", ubicacion=" Temuco ", descripcion=" Detalles ")
        del datos["tipo"]
        conexion = ConexionFalsa(("si", ["ave"], None), None)
        with patch.object(self.api, "conectar", return_value=conexion), patch.object(Path, "write_bytes") as escribir:
            respuesta = self.cliente.put("/api/publicaciones/42", data=datos)
        self.assertEqual(respuesta.status_code, 200, respuesta.text)
        sql, parametros = conexion.consultas[-1]
        self.assertEqual((parametros[0], parametros[2], parametros[5]), ("Aviso", "Temuco", "Detalles"))
        self.assertEqual(parametros[11:13], (None, None))
        self.assertIn("tipo=COALESCE(%s, tipo)", sql)
        self.assertIn("permitir_comentarios=COALESCE(%s, permitir_comentarios)", sql)
        self.assertNotIn("estado=", sql)
        self.assertNotIn("imagen_publicacion", sql)
        escribir.assert_not_called()

    def test_actualizar_guarda_tipo_y_comentarios(self):
        conexion = ConexionFalsa(("si", ["ave"], None), None)
        with patch.object(self.api, "conectar", return_value=conexion):
            respuesta = self.cliente.put("/api/publicaciones/42", data=self.formulario(
                tipo="Arrendador", permitir_comentarios="true"))
        self.assertEqual(respuesta.status_code, 200, respuesta.text)
        self.assertEqual(conexion.consultas[-1][1][11:13], ("Arrendador", True))

    def foto_png(self):
        contenido = BytesIO()
        Image.new("RGB", (2, 2), "white").save(contenido, format="PNG")
        return contenido.getvalue()

    def test_actualizar_reemplaza_portada_o_agrega_primera_imagen(self):
        for portada in ((8,), None):
            with self.subTest(portada=portada):
                conexion = ConexionFalsa(("si", ["ave"], None), None, portada, None)
                with patch.object(self.api, "conectar", return_value=conexion), patch.object(Path, "write_bytes") as escribir:
                    respuesta = self.cliente.put("/api/publicaciones/42", data=self.formulario(),
                        files={"imagen": ("nueva.png", self.foto_png(), "image/png")})
                self.assertEqual(respuesta.status_code, 200, respuesta.text)
                escribir.assert_called_once()
                self.assertIn("UPDATE haycupo.imagen_publicacion", conexion.consultas[2][0])
                self.assertEqual(conexion.consultas[2][1][1], 42)
                self.assertTrue(conexion.consultas[2][1][0].startswith("/imagenes/"))
                self.assertEqual(len(conexion.consultas), 3 if portada else 4)
                self.assertFalse(any("DELETE" in sql for sql, _ in conexion.consultas))

    def test_actualizar_imagen_invalida_no_conecta(self):
        for contenido, estado in ((b"no es foto", 422), (b"x" * (5 * 1024 * 1024 + 1), 413)):
            with self.subTest(estado=estado):
                with patch.object(self.api, "conectar") as conectar, patch.object(Path, "write_bytes") as escribir:
                    respuesta = self.cliente.put("/api/publicaciones/42", data=self.formulario(),
                        files={"imagen": ("foto.png", contenido, "image/png")})
                self.assertEqual(respuesta.status_code, estado, respuesta.text)
                conectar.assert_not_called()
                escribir.assert_not_called()

    def test_actualizar_ajena_no_escribe_imagen(self):
        conexion = ConexionFalsa(None)
        with patch.object(self.api, "conectar", return_value=conexion), patch.object(Path, "write_bytes") as escribir:
            respuesta = self.cliente.put("/api/publicaciones/42", data=self.formulario(),
                files={"imagen": ("nueva.png", self.foto_png(), "image/png")})
        self.assertEqual(respuesta.status_code, 404, respuesta.text)
        escribir.assert_not_called()
        self.assertEqual(len(conexion.consultas), 1)

    def test_imagen_con_demasiados_pixeles_es_422_sin_conectar(self):
        for metodo, ruta in (("post", "/api/publicaciones"), ("put", "/api/publicaciones/42")):
            with self.subTest(metodo=metodo):
                with patch.object(self.api, "conectar") as conectar, \
                        patch.object(self.api.Image, "open", side_effect=Image.DecompressionBombError("demasiados píxeles")):
                    respuesta = getattr(self.cliente, metodo)(ruta, data=self.formulario(),
                        files={"imagen": ("foto.png", b"imagen", "image/png")})
                self.assertEqual(respuesta.status_code, 422, respuesta.text)
                conectar.assert_not_called()

    def test_actualizar_limpia_imagen_nueva_si_falla_guardado(self):
        class ConexionConFallo(ConexionFalsa):
            def execute(self, sql, parametros=None):
                if "UPDATE haycupo.imagen_publicacion" in sql:
                    raise RuntimeError("detalle privado")
                return super().execute(sql, parametros)
        conexion = ConexionConFallo(("si", ["ave"], None), None)
        with patch.object(self.api, "conectar", return_value=conexion), \
                patch.object(Path, "write_bytes") as escribir, patch.object(Path, "unlink") as borrar:
            respuesta = self.cliente.put("/api/publicaciones/42", data=self.formulario(),
                files={"imagen": ("foto.png", self.foto_png(), "image/png")})
        self.assertEqual(respuesta.status_code, 500, respuesta.text)
        self.assertNotIn("detalle privado", respuesta.text)
        escribir.assert_called_once()
        borrar.assert_called_once_with(missing_ok=True)

    def test_cerrar_es_idempotente_conserva_cupos_y_filtra_autor(self):
        for intento in range(2):
            with self.subTest(intento=intento):
                conexion = ConexionFalsa(("Cerrada", 4))
                with patch.object(self.api, "conectar", return_value=conexion):
                    respuesta = self.cliente.patch("/api/publicaciones/42/cerrar")
                self.assertEqual(respuesta.status_code, 200, respuesta.text)
                self.assertEqual(respuesta.json(), {
                    "id": 42, "estado": "Cerrada", "cupos_totales": 4, "cupos_disponibles": 0})
                sql, parametros = conexion.consultas[0]
                self.assertEqual(parametros, (42, 1))
                self.assertIn("AND id_usuario = %s", sql)
                self.assertNotIn("DELETE", sql)
                self.assertNotIn("cupos_totales =", sql)

    def test_cerrar_ajena_o_inexistente_es_404(self):
        conexion = ConexionFalsa(None)
        with patch.object(self.api, "conectar", return_value=conexion):
            respuesta = self.cliente.patch("/api/publicaciones/42/cerrar")
        self.assertEqual(respuesta.status_code, 404, respuesta.text)
        self.assertEqual(len(conexion.consultas), 1)

    def test_cupos_actuales_en_abiertas_y_cerradas(self):
        for estado, disponibles in (("Disponible", 4), ("Activa", 4), ("Cerrada", 0), ("cerrada", 0)):
            with self.subTest(estado=estado):
                conexion = ConexionFalsa((estado, 4))
                with patch.object(self.api, "conectar", return_value=conexion):
                    respuesta = self.cliente.get("/api/publicaciones/42/cupos")
                self.assertEqual(respuesta.status_code, 200, respuesta.text)
                self.assertEqual(respuesta.json(), {
                    "id": 42, "estado": estado, "cupos_totales": 4, "cupos_disponibles": disponibles})
                self.assertEqual(conexion.consultas[0][1], (42,))

    def test_estado_nulo_legacy_se_muestra_disponible_en_todas_las_consultas(self):
        fila_publica = (42, "Habitación", Decimal("150000"), "Temuco", 4, "casa", None,
                        "ofrezco", "Descripción", "no", None, [], None, None)
        fila_propia = (42, "Habitación", Decimal("150000"), None, "casa", "Temuco", 4, None)
        fila_detalle = ("Habitación", "ofrezco", "casa", "Temuco", Decimal("150000"),
                        4, "no", "Descripción", [], None, None, "Compartida", False, None)
        casos = (
            ("/api/publicaciones", [fila_publica], True),
            ("/api/publicaciones/buscar", [fila_publica], True),
            ("/api/mis-publicaciones", [fila_propia], True),
            ("/api/publicaciones/42", fila_detalle, False),
            ("/api/publicaciones/42/cupos", (None, 4), False),
        )
        for ruta, filas, es_lista in casos:
            with self.subTest(ruta=ruta):
                conexion = ConexionFalsa(filas)
                with patch.object(self.api, "conectar", return_value=conexion):
                    respuesta = self.cliente.get(ruta)
                self.assertEqual(respuesta.status_code, 200, respuesta.text)
                datos = respuesta.json()[0] if es_lista else respuesta.json()
                self.assertEqual(datos["estado"], "Disponible")
                self.assertEqual(datos["cupos_totales"], 4)
                self.assertEqual(datos["cupos_disponibles"], 4)
                if ruta in ("/api/publicaciones", "/api/publicaciones/buscar"):
                    self.assertIn("LOWER(COALESCE(p.estado, 'Disponible')) <> 'cerrada'",
                                  conexion.consultas[0][0])

    def test_cupos_y_detalle_inexistentes_son_404(self):
        for ruta in ("/api/publicaciones/42", "/api/publicaciones/42/cupos"):
            with self.subTest(ruta=ruta):
                with patch.object(self.api, "conectar", return_value=ConexionFalsa(None)):
                    respuesta = self.cliente.get(ruta)
                self.assertEqual(respuesta.status_code, 404, respuesta.text)

    def test_cupos_cierre_y_detalle_no_exponen_error_de_base_de_datos(self):
        for metodo, ruta in (("get", "/api/publicaciones/42"), ("get", "/api/publicaciones/42/cupos"),
                             ("patch", "/api/publicaciones/42/cerrar")):
            with self.subTest(ruta=ruta):
                with patch.object(self.api, "conectar", side_effect=RuntimeError("detalle privado")):
                    respuesta = getattr(self.cliente, metodo)(ruta)
                self.assertEqual(respuesta.status_code, 500, respuesta.text)
                self.assertNotIn("detalle privado", respuesta.text)

    def test_mis_publicaciones_incluye_cerradas_una_vez_y_cupos_actuales(self):
        conexion = ConexionFalsa([
            (42, "Cerrada", Decimal("150000"), "Cerrada", "casa", "Temuco", 4, "/imagenes/casa.png"),
            (41, "Abierta", Decimal("150000"), "Disponible", "casa", "Temuco", 2, None),
        ])
        with patch.object(self.api, "conectar", return_value=conexion):
            respuesta = self.cliente.get("/api/mis-publicaciones")
        self.assertEqual(respuesta.status_code, 200, respuesta.text)
        self.assertEqual([p["cupos_disponibles"] for p in respuesta.json()], [0, 2])
        self.assertEqual([p["cupos_totales"] for p in respuesta.json()], [4, 2])
        sql, parametros = conexion.consultas[0]
        self.assertNotIn("JOIN", sql)
        self.assertIn("ORDER BY i.orden, i.id_imagen LIMIT 1", sql)
        self.assertEqual(parametros, (1,))

    def test_eliminar_ajena_no_borra_imagenes(self):
        conexion = ConexionFalsa(None)
        with patch.object(self.api, "conectar", return_value=conexion):
            respuesta = self.cliente.delete("/api/publicaciones/42")
        self.assertEqual(respuesta.status_code, 404, respuesta.text)
        self.assertEqual(len(conexion.consultas), 1)
        self.assertNotIn("DELETE", conexion.consultas[0][0])

    def test_eliminar_propia_borra_imagenes_despues_de_comprobar_autor(self):
        conexion = ConexionFalsa((42,), None, None)
        with patch.object(self.api, "conectar", return_value=conexion):
            respuesta = self.cliente.delete("/api/publicaciones/42")
        self.assertEqual(respuesta.status_code, 200, respuesta.text)
        self.assertEqual(conexion.consultas[0][1], (42, 1))
        self.assertEqual(len(conexion.consultas), 3)

    def test_cookie_invalida_es_401_y_no_conecta(self):
        for cookie in ("no-numero", "0", "-1"):
            with self.subTest(cookie=cookie):
                cliente = TestClient(self.api.app)
                try:
                    cliente.cookies.set("roomies_id", cookie)
                    with patch.object(self.api, "conectar") as conectar:
                        respuesta = cliente.patch("/api/publicaciones/42/cerrar")
                finally:
                    cliente.close()
                self.assertEqual(respuesta.status_code, 401, respuesta.text)
                conectar.assert_not_called()

    def test_salud_microservicio_independiente(self):
        with TestClient(servicio) as cliente:
            respuesta = cliente.get("/health")
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.json()["estado"], "ok")
        self.assertEqual(servicio.version, "1.0.0")


if __name__ == "__main__":
    unittest.main()
