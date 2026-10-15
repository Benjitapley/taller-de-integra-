"""Validación y API con conexiones falsas, sin modificar PostgreSQL."""

import importlib.util
import sys
import types
import unittest
from decimal import Decimal
from pathlib import Path
from unittest.mock import patch

from fastapi import APIRouter
from fastapi.testclient import TestClient
from pydantic import ValidationError
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
                1, "si", "Cerca del centro", ["ave", "tortuga"], "Máximo dos")
        with patch.object(self.api, "conectar", return_value=ConexionFalsa(fila)):
            respuesta = self.cliente.get("/api/publicaciones/42")
        self.assertEqual(respuesta.status_code, 200, respuesta.text)
        self.assertEqual(respuesta.json()["tipos_mascotas_aceptadas"], ["ave", "tortuga"])
        self.assertEqual(respuesta.json()["condiciones_mascotas"], "Máximo dos")

    def test_listado_legacy_devuelve_lista_vacia(self):
        fila = (42, "Habitación", Decimal("150000"), "Temuco", 1, "casa", None,
                "ofrezco", "Descripción", "si", None, None, None)
        with patch.object(self.api, "conectar", return_value=ConexionFalsa([fila])):
            respuesta = self.cliente.get("/api/publicaciones")
        self.assertEqual(respuesta.status_code, 200, respuesta.text)
        self.assertEqual(respuesta.json()[0]["tipos_mascotas_aceptadas"], [])

    def test_salud_microservicio_independiente(self):
        with TestClient(servicio) as cliente:
            respuesta = cliente.get("/health")
        self.assertEqual(respuesta.status_code, 200)
        self.assertEqual(respuesta.json()["estado"], "ok")
        self.assertEqual(servicio.version, "1.0.0")


if __name__ == "__main__":
    unittest.main()
