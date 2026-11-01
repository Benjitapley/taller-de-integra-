"""Configuración de conexiones sin leer .env ni acceder a PostgreSQL."""

import importlib.util
import os
from pathlib import Path
import unittest
from unittest.mock import patch

from test_publicaciones import cargar_api_sin_servicios_externos


class ConfiguracionConexionTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with patch("dotenv.load_dotenv", return_value=False):
            cls.api = cargar_api_sin_servicios_externos()
            ruta = Path(__file__).resolve().parents[1] / "auth_service" / "main.py"
            spec = importlib.util.spec_from_file_location("auth_bajo_prueba", ruta)
            cls.auth = importlib.util.module_from_spec(spec)
            spec.loader.exec_module(cls.auth)

    def test_ambos_servicios_usan_database_url_configurada(self):
        urls = ("postgresql://localhost/haycupo_prueba", "postgresql://localhost/otra_prueba")
        for servicio in (self.api, self.auth):
            for url in urls:
                with self.subTest(servicio=servicio.__name__, url=url):
                    conexion = object()
                    with patch.dict(os.environ, {"DATABASE_URL": url}), \
                            patch.object(servicio.psycopg, "connect", return_value=conexion) as conectar:
                        self.assertIs(servicio.conectar(), conexion)
                    conectar.assert_called_once_with(url, connect_timeout=10)

    def test_sin_database_url_no_intenta_conectar_a_otro_destino(self):
        for servicio in (self.api, self.auth):
            for valor in (None, ""):
                with self.subTest(servicio=servicio.__name__, valor=valor), patch.dict(os.environ):
                    os.environ.pop("DATABASE_URL", None)
                    if valor is not None:
                        os.environ["DATABASE_URL"] = valor
                    with patch.object(servicio.psycopg, "connect") as conectar:
                        with self.assertRaisesRegex(RuntimeError, "Falta configurar DATABASE_URL"):
                            servicio.conectar()
                    conectar.assert_not_called()


if __name__ == "__main__":
    unittest.main()
