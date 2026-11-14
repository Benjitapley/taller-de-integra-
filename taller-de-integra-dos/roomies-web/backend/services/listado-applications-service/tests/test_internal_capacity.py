import os
from pathlib import Path
import sys
import unittest

from fastapi import FastAPI
from fastapi.testclient import TestClient

service_root = Path(__file__).resolve().parents[1]
repository_root = service_root.parents[2]
sys.path.insert(0, str(service_root))
sys.path.insert(0, str(repository_root))

from app.api.routes import router, service as service_dependency
from backend.service_runtime.http import configure


class FakeRepository:
    def __init__(self):
        self.reservations = []
        self.releases = []
        self.occupancies = []

    def internal_publication(self, publication_id):
        return {
            "id_publicacion": publication_id,
            "id_usuario": 10,
            "tipo": "Arrendador",
            "estado": "Disponible",
            "cupos_totales": 2,
        }

    def reserve_capacity(self, event_key, publication_id, application_id, user_id):
        self.reservations.append((event_key, publication_id, application_id, user_id))
        return {"id_reserva": 1, "id_publicacion": publication_id}

    def release_capacity(self, event_key, publication_id):
        self.releases.append((event_key, publication_id))

    def update_occupancy(self, data):
        self.occupancies.append(data)
        return {"actualizado": True, "version_ocupacion": data["version_ocupacion"]}


class FakePublications:
    def __init__(self):
        self.repository = FakeRepository()


class CapacityApiTests(unittest.TestCase):
    def setUp(self):
        self.previous_token = os.environ.get("ROOMIES_INTERNAL_TOKEN")
        os.environ["ROOMIES_INTERNAL_TOKEN"] = "i" * 32
        self.publications = FakePublications()
        self.app = FastAPI()
        configure(self.app)
        self.app.include_router(router)
        self.app.dependency_overrides[service_dependency] = lambda: self.publications
        self.client = TestClient(self.app)

    def tearDown(self):
        self.client.close()
        if self.previous_token is None:
            os.environ.pop("ROOMIES_INTERNAL_TOKEN", None)
        else:
            os.environ["ROOMIES_INTERNAL_TOKEN"] = self.previous_token

    def test_internal_routes_require_service_authentication(self):
        result = self.client.get("/internal/publicaciones/45")
        self.assertEqual(result.status_code, 403)

    def test_reservation_and_versioned_occupancy_contract(self):
        headers = {"X-Roomies-Service": "i" * 32}
        reservation = self.client.post(
            "/internal/publicaciones/45/reservas",
            headers=headers,
            json={
                "event_key": "postulacion:9:Aceptada",
                "id_postulacion": 9,
                "id_usuario": 7,
            },
        )
        self.assertEqual(reservation.status_code, 201)
        self.assertEqual(
            self.publications.repository.reservations,
            [("postulacion:9:Aceptada", 45, 9, 7)],
        )
        occupancy = {
            "event_key": "ocupacion:45:1",
            "clave_incorporacion": "postulacion:9:Aceptada",
            "id_reserva": 1,
            "id_usuario": 7,
            "id_publicacion": 45,
            "version_ocupacion": 1,
            "cupos_totales": 2,
            "cupos_ocupados": 1,
            "estado": "Activa",
        }
        updated = self.client.put(
            "/internal/publicaciones/45/ocupacion",
            headers=headers,
            json=occupancy,
        )
        self.assertEqual(updated.status_code, 200)
        self.assertEqual(updated.json()["version_ocupacion"], 1)

    def test_reservation_key_must_match_application(self):
        response = self.client.post(
            "/internal/publicaciones/45/reservas",
            headers={"X-Roomies-Service": "i" * 32},
            json={
                "event_key": "postulacion:10:Aceptada",
                "id_postulacion": 9,
                "id_usuario": 7,
            },
        )
        self.assertEqual(response.status_code, 422)


if __name__ == "__main__":
    unittest.main()
