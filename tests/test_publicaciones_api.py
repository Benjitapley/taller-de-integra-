import unittest
from unittest.mock import patch

import main.main as api


class FakeConnection:
    def __init__(self, rows):
        self.rows = rows
        self.query = None
        self.params = None

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def execute(self, query, params):
        self.query = query
        self.params = params
        return self

    def fetchall(self):
        return self.rows


class PublicacionesApiTest(unittest.TestCase):
    def test_busca_publicaciones_con_todos_los_filtros(self):
        connection = FakeConnection([])

        with patch.object(api, "conectar", return_value=connection):
            publicaciones = api.obtener_publicaciones(
                consulta=" Temuco ",
                personas=3,
                tipo="casa",
                mascotas="si",
            )

        self.assertEqual(publicaciones, [])
        self.assertIn("p.ubicacion ILIKE %s", connection.query)
        self.assertIn("p.cupos_totales >= %s", connection.query)
        self.assertIn("p.tipo_vivienda = %s", connection.query)
        self.assertIn("p.mascota = %s", connection.query)
        self.assertEqual(connection.params, ["%Temuco%", 3, "casa", "si"])

    def test_sin_filtros_devuelve_todos_los_resultados(self):
        connection = FakeConnection(
            [(1, "Habitación", 150000, "Temuco", 3, "casa", None, "ofrezco", "Descripción", "si", None)]
        )

        with patch.object(api, "conectar", return_value=connection):
            publicaciones = api.obtener_publicaciones()

        self.assertNotIn("WHERE", connection.query)
        self.assertEqual(
            publicaciones,
            [
                {
                    "id": 1,
                    "titulo": "Habitación",
                    "precio": 150000.0,
                    "ubicacion": "Temuco",
                    "cupos_totales": 3,
                    "tipo_vivienda": "casa",
                    "imagen": None,
                    "categoria": "ofrezco",
                    "descripcion": "Descripción",
                    "mascota": "si",
                }
            ],
        )


if __name__ == "__main__":
    unittest.main()
