from typing import Protocol
import hashlib
import json
import logging
from uuid import UUID

from backend.service_runtime.contracts import DependencyUnavailable, RuleViolation
from app.domain.convivencia import (
    Reservation,
    validate_admission,
    validate_message,
    validate_removal,
)

logger = logging.getLogger("convivencia.outbox")


class Repository(Protocol):
    def transaction(self): ...
    def command(self, event_key, fingerprint): ...
    def incorporate(self, event_key, fingerprint, reservation): ...
    def internal_members(self, rental_id): ...
    def my_rental(self, user_id): ...
    def rental_for_member(self, rental_id, user_id): ...
    def rental_publication_id(self, rental_id): ...
    def members(self, rental_id, user_id, before, limit): ...
    def conversations(self, user_id, before, limit): ...
    def conversation(self, conversation_id, user_id): ...
    def messages(self, conversation_id, user_id, before, limit): ...
    def send_message(self, conversation_id, user_id, client_message_id, content): ...
    def expel(self, rental_id, actor_id, target_id, idempotency_key, reason, fingerprint): ...
    def historical_relation(self, user_a, user_b): ...
    def claim_outbox(self, limit): ...
    def delivered(self, event_id): ...
    def retry_outbox(self, event_id, attempts): ...


class CapacityPort(Protocol):
    def reserve(self, event_key, publication_id, application_id, applicant_id) -> Reservation: ...
    def release(self, event_key, publication_id): ...
    def publication(self, publication_id): ...
    def publish_occupancy(self, event): ...


class Convivencia:
    def __init__(self, repository: Repository, capacity: CapacityPort):
        self.repository = repository
        self.capacity = capacity

    def incorporate(self, event_key, publication_id, application_id, applicant_id):
        validate_admission(event_key, publication_id, application_id, applicant_id)
        fingerprint = hashlib.sha256(
            json.dumps(
                [publication_id, application_id, applicant_id],
                separators=(",", ":"),
            ).encode("ascii")
        ).hexdigest()
        previous = self.repository.command(event_key, fingerprint)
        if previous is not None:
            return previous

        reservation = self.capacity.reserve(
            event_key, publication_id, application_id, applicant_id
        )
        if (reservation.publication_id != publication_id
                or reservation.applicant_id != applicant_id):
            raise DependencyUnavailable("La reserva no coincide con la incorporación.")
        try:
            return self.repository.incorporate(event_key, fingerprint, reservation)
        except RuleViolation:
            self.capacity.release(event_key, publication_id)
            raise

    def my_rental(self, user_id):
        rental = self.repository.my_rental(user_id)
        if rental is None:
            raise RuleViolation("No tienes un arriendo activo.", 404)
        return rental

    def internal_members(self, rental_id):
        return self.repository.internal_members(rental_id)

    def rental(self, rental_id, user_id):
        rental = self.repository.rental_for_member(rental_id, user_id)
        if rental is None:
            raise RuleViolation("Arriendo no encontrado.", 404)
        return rental

    def members(self, rental_id, user_id, before, limit):
        rental = self.rental(rental_id, user_id)
        return rental, self.repository.members(rental_id, user_id, before, limit)

    def conversations(self, user_id, before, limit):
        return self.repository.conversations(user_id, before, limit)

    def conversation(self, conversation_id, user_id):
        conversation = self.repository.conversation(conversation_id, user_id)
        if conversation is None:
            raise RuleViolation("Conversación no encontrada.", 404)
        return conversation

    def messages(self, conversation_id, user_id, before, limit):
        self.conversation(conversation_id, user_id)
        return self.repository.messages(conversation_id, user_id, before, limit)

    def send_message(self, conversation_id, user_id, client_message_id, content):
        self.conversation(conversation_id, user_id)
        return self.repository.send_message(
            conversation_id,
            user_id,
            str(UUID(client_message_id)),
            validate_message(content, client_message_id),
        )

    def expel(self, rental_id, actor_id, target_id, idempotency_key, reason, confirmation):
        reason = validate_removal(reason, confirmation)
        listing = self.capacity.publication(
            self.repository.rental_publication_id(rental_id)
        )
        if listing["owner_id"] != actor_id:
            raise RuleViolation("Solo el dueño de la publicación puede retirar integrantes.", 403)
        fingerprint = hashlib.sha256(
            json.dumps(
                [rental_id, actor_id, target_id, reason],
                ensure_ascii=True,
                separators=(",", ":"),
            ).encode("ascii")
        ).hexdigest()
        return self.repository.expel(
            rental_id, actor_id, target_id, idempotency_key, reason, fingerprint
        )

    def historical_relation(self, user_a, user_b):
        if user_a == user_b:
            return False
        return self.repository.historical_relation(user_a, user_b)

    def deliver_outbox(self, limit=20):
        events = self.repository.claim_outbox(limit)
        for event in events:
            try:
                self.capacity.publish_occupancy(event)
                self.repository.delivered(event["id_evento"])
            except (DependencyUnavailable, RuleViolation) as error:
                self.repository.retry_outbox(event["id_evento"], event["intentos"])
                logger.warning(
                    "outbox event %s deferred: %s",
                    event["id_evento"],
                    type(error).__name__,
                )
