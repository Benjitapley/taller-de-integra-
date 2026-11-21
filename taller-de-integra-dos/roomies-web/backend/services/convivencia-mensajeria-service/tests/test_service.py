import os
from pathlib import Path
import sys
import unittest
from datetime import datetime, timedelta, timezone
from uuid import UUID, uuid4

service_root = Path(__file__).resolve().parents[1]
repository_root = service_root.parents[2]
sys.path.insert(0, str(service_root))
sys.path.insert(0, str(repository_root))

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.api.cursor import decode, encode
from app.api.routes import router, service as service_dependency
from app.application.service import Convivencia
from app.domain.convivencia import Reservation, validate_message
from backend.service_runtime.contracts import Actor, RuleViolation
from backend.service_runtime.http import configure
from backend.service_runtime.security import confirmed_actor


class FakeRepository:
    def __init__(self):
        self.commands = {}
        self.active = set()
        self.removed = set()
        self.publications = {1: 45}
        self.message_rows = [
            {
                "id_mensaje": message_id,
                "id_usuario": 7,
                "id_cliente": str(uuid4()),
                "contenido": f"mensaje {message_id}",
                "creado_en": datetime(2026, 11, 14, tzinfo=timezone.utc),
            }
            for message_id in (3, 2, 1)
        ]
        self.member_rows = [
            {
                "id_pertenencia": member_id,
                "id_usuario": member_id + 6,
                "rol": "Integrante",
                "ingreso_en": datetime(2026, 11, 14, tzinfo=timezone.utc),
            }
            for member_id in (3, 2, 1)
        ]
        self.conversation_rows = [
            {
                "id_conversacion": conversation_id,
                "id_arriendo": conversation_id,
                "id_publicacion": conversation_id + 40,
                "estado": "Activo",
                "creada_en": datetime(2026, 11, 14, tzinfo=timezone.utc),
                "ingreso_en": datetime(2026, 11, 14, tzinfo=timezone.utc),
                "ultimo_mensaje": None,
            }
            for conversation_id in (3, 2, 1)
        ]
        self.expel_calls = 0

    def command(self, event_key, fingerprint):
        previous = self.commands.get(event_key)
        if previous is None:
            return None
        if previous[0] != fingerprint:
            raise RuleViolation("Clave reutilizada.", 409)
        return previous[1]

    def incorporate(self, event_key, fingerprint, reservation):
        previous = self.command(event_key, fingerprint)
        if previous is not None:
            return previous
        if reservation.applicant_id in self.active:
            raise RuleViolation("Pertenencia activa.", 409)
        self.active.add(reservation.applicant_id)
        result = {"id_arriendo": 1, "id_publicacion": reservation.publication_id}
        self.commands[event_key] = fingerprint, result
        return result

    def rental_publication_id(self, rental_id):
        return self.publications[rental_id]

    def expel(self, rental_id, actor_id, target_id, idempotency_key, reason, fingerprint):
        key = f"retiro:{rental_id}:{idempotency_key}"
        previous = self.command(key, fingerprint)
        if previous is not None:
            return previous
        if target_id not in self.active:
            raise RuleViolation("No está activo.", 404)
        self.active.remove(target_id)
        self.removed.add(target_id)
        self.expel_calls += 1
        result = {"id_usuario": target_id, "estado_pertenencia": "Retirada"}
        self.commands[key] = fingerprint, result
        return result

    def conversation(self, conversation_id, user_id):
        if user_id not in self.active:
            return None
        return {"id_conversacion": conversation_id, "id_arriendo": 1}

    def messages(self, conversation_id, user_id, before, limit):
        rows = self.message_rows
        if before is not None:
            rows = [
                row for row in rows
                if (row["creado_en"], row["id_mensaje"]) < before
            ]
        return rows[:limit]

    def send_message(self, conversation_id, user_id, client_message_id, content):
        return {
            "id_mensaje": 9,
            "id_usuario": user_id,
            "id_cliente": client_message_id,
            "contenido": content,
            "creado_en": datetime.now(timezone.utc),
        }

    def my_rental(self, user_id):
        return None

    def rental_for_member(self, rental_id, user_id):
        if user_id not in self.active:
            return None
        return {
            "id_arriendo": rental_id,
            "capacidad": 3,
            "cupos_ocupados": len(self.active),
        }

    def members(self, rental_id, user_id, before, limit):
        rows = self.member_rows
        if before is not None:
            rows = [
                row for row in rows
                if (row["ingreso_en"], row["id_pertenencia"]) < before
            ]
        return rows[:limit]

    def conversations(self, user_id, before, limit):
        rows = self.conversation_rows
        if before is not None:
            rows = [
                row for row in rows
                if (row["creada_en"], row["id_conversacion"]) < before
            ]
        return rows[:limit]

    def historical_relation(self, user_a, user_b):
        return False


class FakeCapacity:
    def __init__(self, owner_id=10):
        self.owner_id = owner_id
        self.reserve_calls = 0
        self.releases = []

    def reserve(self, event_key, publication_id, application_id, applicant_id):
        self.reserve_calls += 1
        return Reservation(
            reservation_id=1,
            publication_id=publication_id,
            applicant_id=applicant_id,
            owner_id=self.owner_id,
            capacity=3,
            version=0,
            expires_at=datetime.now(timezone.utc) + timedelta(minutes=5),
        )

    def release(self, event_key, publication_id):
        self.releases.append((event_key, publication_id))

    def publication(self, publication_id):
        return {"owner_id": self.owner_id}

    def publish_occupancy(self, event):
        return None


class DomainTests(unittest.TestCase):
    def setUp(self):
        self.previous_cursor = os.environ.get("ROOMIES_CURSOR_SECRET")
        os.environ["ROOMIES_CURSOR_SECRET"] = "c" * 32
        self.repository = FakeRepository()
        self.capacity = FakeCapacity()
        self.app = Convivencia(self.repository, self.capacity)

    def tearDown(self):
        if self.previous_cursor is None:
            os.environ.pop("ROOMIES_CURSOR_SECRET", None)
        else:
            os.environ["ROOMIES_CURSOR_SECRET"] = self.previous_cursor

    def test_admission_retry_returns_same_membership(self):
        first = self.app.incorporate("postulacion:8:Aceptada", 45, 8, 7)
        second = self.app.incorporate("postulacion:8:Aceptada", 45, 8, 7)
        self.assertEqual(first, second)
        self.assertEqual(self.capacity.reserve_calls, 1)
        self.assertEqual(self.repository.active, {7})

    def test_admission_key_cannot_be_reused_for_another_payload(self):
        self.app.incorporate("postulacion:8:Aceptada", 45, 8, 7)
        with self.assertRaises(RuleViolation) as error:
            self.app.incorporate("postulacion:8:Aceptada", 45, 8, 9)
        self.assertEqual(error.exception.status, 409)
        self.assertEqual(self.capacity.reserve_calls, 1)

    def test_non_owner_admin_does_not_gain_removal_permission(self):
        self.repository.active.add(7)
        with self.assertRaises(RuleViolation) as error:
            self.app.expel(1, 99, 7, "remove-1", "motivo", True)
        self.assertEqual(error.exception.status, 403)
        self.assertEqual(self.repository.expel_calls, 0)

    def test_owner_removal_is_idempotent(self):
        self.repository.active.add(7)
        first = self.app.expel(1, 10, 7, "remove-1", "motivo", True)
        second = self.app.expel(1, 10, 7, "remove-1", "motivo", True)
        self.assertEqual(first, second)
        self.assertEqual(self.repository.expel_calls, 1)
        self.assertNotIn(7, self.repository.active)

    def test_message_content_is_trimmed_and_bounded(self):
        message_id = str(uuid4())
        self.assertEqual(validate_message("  hola  ", message_id), "hola")
        with self.assertRaises(RuleViolation):
            validate_message("  ", str(uuid4()))
        with self.assertRaises(RuleViolation):
            validate_message("x" * 2001, str(uuid4()))

    def test_cursor_is_signed_and_bound_to_user_and_conversation(self):
        row = self.repository.message_rows[0]
        encoded = encode(5, 7, row)
        self.assertEqual(decode(encoded, 5, 7), (row["creado_en"], 3))
        with self.assertRaises(RuleViolation):
            decode(encoded, 6, 7)
        with self.assertRaises(RuleViolation):
            decode(encoded, 5, 8)
        tampered = encoded[:-1] + ("A" if encoded[-1] != "A" else "B")
        with self.assertRaises(RuleViolation):
            decode(tampered, 5, 7)

    def test_member_and_conversation_cursors_keep_tie_breakers(self):
        from app.api.cursor import (
            decode_conversations,
            decode_members,
            encode_conversations,
            encode_members,
        )

        member_cursor = encode_members(1, 7, self.repository.member_rows[1])
        self.assertEqual(decode_members(member_cursor, 1, 7), (
            self.repository.member_rows[1]["ingreso_en"], 2
        ))
        conversation_cursor = encode_conversations(7, self.repository.conversation_rows[1])
        self.assertEqual(decode_conversations(conversation_cursor, 7), (
            self.repository.conversation_rows[1]["creada_en"], 2
        ))


class ApiTests(unittest.TestCase):
    def setUp(self):
        self.previous_token = os.environ.get("ROOMIES_INTERNAL_TOKEN")
        self.previous_cursor = os.environ.get("ROOMIES_CURSOR_SECRET")
        os.environ["ROOMIES_CURSOR_SECRET"] = "c" * 32
        self.repository = FakeRepository()
        self.repository.active.add(7)
        self.capacity = FakeCapacity()
        self.app_service = Convivencia(self.repository, self.capacity)
        self.test_app = FastAPI()
        configure(self.test_app)
        self.test_app.include_router(router)
        self.test_app.dependency_overrides[service_dependency] = lambda: self.app_service
        self.test_app.dependency_overrides[confirmed_actor] = lambda: Actor(
            UUID("00000000-0000-0000-0000-000000000007"), 7, True, False
        )
        self.client = TestClient(self.test_app)

    def tearDown(self):
        self.client.close()
        if self.previous_token is None:
            os.environ.pop("ROOMIES_INTERNAL_TOKEN", None)
        else:
            os.environ["ROOMIES_INTERNAL_TOKEN"] = self.previous_token
        if self.previous_cursor is None:
            os.environ.pop("ROOMIES_CURSOR_SECRET", None)
        else:
            os.environ["ROOMIES_CURSOR_SECRET"] = self.previous_cursor

    def test_messages_use_stable_cursor_and_return_expected_shape(self):
        first = self.client.get("/api/conversaciones/5/mensajes?limite=2")
        self.assertEqual(first.status_code, 200)
        self.assertEqual([row["id_mensaje"] for row in first.json()["items"]], [3, 2])
        cursor = first.json()["siguiente_cursor"]
        second = self.client.get(
            "/api/conversaciones/5/mensajes",
            params={"limite": 2, "antes": cursor},
        )
        self.assertEqual(second.status_code, 200, second.text)
        self.assertEqual([row["id_mensaje"] for row in second.json()["items"]], [1])
        self.assertIsNone(second.json()["siguiente_cursor"])

    def test_outside_member_cannot_read_or_send_chat(self):
        def outsider():
            return Actor(
                UUID("00000000-0000-0000-0000-000000000999"),
                999,
                True,
                False,
            )

        self.test_app.dependency_overrides[confirmed_actor] = outsider
        try:
            denied_read = self.client.get("/api/conversaciones/5/mensajes")
            denied_send = self.client.post(
                "/api/conversaciones/5/mensajes",
                json={
                    "id_cliente": str(uuid4()),
                    "contenido": "mensaje no autorizado",
                },
            )
            self.assertEqual(denied_read.status_code, 404)
            self.assertEqual(denied_send.status_code, 404)
        finally:
            self.test_app.dependency_overrides[confirmed_actor] = lambda: Actor(
                UUID("00000000-0000-0000-0000-000000000007"), 7, True, False
            )

    def test_member_and_conversation_lists_are_paginated(self):
        members = self.client.get("/api/arriendos/1/integrantes?limite=2")
        self.assertEqual([row["id_pertenencia"] for row in members.json()["items"]], [3, 2])
        self.assertEqual(members.json()["cupos_totales"], 3)
        self.assertIsNotNone(members.json()["siguiente_cursor"])

        conversations = self.client.get("/api/conversaciones?limite=2")
        self.assertEqual(
            [row["id_conversacion"] for row in conversations.json()["items"]],
            [3, 2],
        )
        self.assertIsNotNone(conversations.json()["siguiente_cursor"])

    def test_internal_admission_requires_service_token(self):
        os.environ["ROOMIES_INTERNAL_TOKEN"] = "x" * 32
        payload = {
            "event_key": "postulacion:8:Aceptada",
            "id_postulacion": 8,
            "id_publicacion": 45,
            "id_usuario": 9,
        }
        denied = self.client.post("/internal/incorporaciones", json=payload)
        self.assertEqual(denied.status_code, 403)
        allowed = self.client.post(
            "/internal/incorporaciones",
            json=payload,
            headers={"X-Roomies-Service": "x" * 32},
        )
        self.assertEqual(allowed.status_code, 200)
        self.assertEqual(allowed.json()["id_arriendo"], 1)


if __name__ == "__main__":
    unittest.main()
