import os
import unittest

os.environ["DATABASE_URL"] = "sqlite://"

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from match_conexion_service.models import Base, Conexion, EstadoConexion, Match, Publicacion, Usuario
from match_conexion_service.routes import (
    buscar_publicaciones,
    buscar_usuarios,
    enviar_solicitud,
    listar_verificaciones,
    responder_solicitud,
    verificar_conexion,
    ver_matches,
    ver_solicitudes_enviadas,
    ver_solicitudes_recibidas,
)
from match_conexion_service.schemas import ConexionCreate, ConexionUpdate


class MatchConnectionsTest(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.engine = create_engine("sqlite://")
        Base.metadata.create_all(cls.engine)
        cls.session_factory = sessionmaker(bind=cls.engine)

    def setUp(self):
        self.db = self.session_factory()
        self.db.add_all(
            [
                Usuario(
                    id_usuario_PK=1,
                    nombre="Ana",
                    presupuesto=400000,
                    zona_interes="Centro",
                    ocupacion="Estudiante",
                ),
                Usuario(
                    id_usuario_PK=2,
                    nombre="Luis",
                    presupuesto=600000,
                    zona_interes="Norte",
                    ocupacion="Trabajador",
                ),
                Publicacion(
                    id_publicacion_PK=1,
                    titulo="Departamento centro",
                    precio=350000,
                    ubicacion="Centro",
                    tipo="ofrezco",
                    estado="Activa",
                    cupos_totales=2,
                    tipo_vivienda="departamento",
                    mascotas="no",
                ),
            ]
        )
        self.db.commit()

    def tearDown(self):
        self.db.close()
        with self.engine.begin() as connection:
            for table in reversed(Base.metadata.sorted_tables):
                connection.execute(table.delete())

    def test_flujo_completo_de_solicitud_match_y_verificacion(self):
        solicitud = enviar_solicitud(ConexionCreate(id_solicitante_FK=1, id_receptor_FK=2), self.db)
        self.assertEqual(solicitud.estado, EstadoConexion.Pendiente)
        self.assertEqual(len(ver_solicitudes_recibidas(2, self.db)), 1)
        self.assertEqual(len(ver_solicitudes_enviadas(1, self.db)), 1)

        aceptada = responder_solicitud(
            solicitud.id_conexion,
            ConexionUpdate(estado=EstadoConexion.Aceptada),
            self.db,
        )
        self.assertEqual(aceptada.estado, EstadoConexion.Aceptada)
        self.assertEqual(self.db.query(Match).count(), 1)
        self.assertEqual(len(ver_matches(1, self.db)), 1)
        self.assertEqual(len(listar_verificaciones(True, self.db)), 1)

        verificada = verificar_conexion(solicitud.id_conexion, self.db)
        self.assertTrue(verificada.verificada)
        self.assertEqual(len(listar_verificaciones(True, self.db)), 0)

    def test_rechaza_auto_solicitud_y_duplicados(self):
        with self.assertRaises(Exception):
            enviar_solicitud(ConexionCreate(id_solicitante_FK=1, id_receptor_FK=1), self.db)

        enviar_solicitud(ConexionCreate(id_solicitante_FK=1, id_receptor_FK=2), self.db)
        with self.assertRaises(Exception):
            enviar_solicitud(ConexionCreate(id_solicitante_FK=2, id_receptor_FK=1), self.db)

    def test_filtros_de_usuarios_y_publicaciones(self):
        usuarios = buscar_usuarios(
            presupuesto_max=500000,
            zona="cent",
            ocupacion=None,
            db=self.db,
        )
        self.assertEqual([usuario.id_usuario_PK for usuario in usuarios], [1])

        publicaciones = buscar_publicaciones(
            consulta="centro",
            personas="dos",
            tipo="departamento",
            mascotas="no",
            db=self.db,
        )
        self.assertEqual([publicacion.id_publicacion_PK for publicacion in publicaciones], [1])


if __name__ == "__main__":
    unittest.main()
