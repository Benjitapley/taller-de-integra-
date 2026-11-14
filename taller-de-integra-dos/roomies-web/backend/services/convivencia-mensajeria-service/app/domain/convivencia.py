from dataclasses import dataclass
from datetime import datetime, timezone
import re
from uuid import UUID

from backend.service_runtime.contracts import RuleViolation


EVENT_KEY = re.compile(r"^postulacion:[1-9][0-9]*:Aceptada$")
MESSAGE_LIMIT = 2000


@dataclass(frozen=True)
class Reservation:
    reservation_id: int
    publication_id: int
    applicant_id: int
    owner_id: int
    capacity: int
    version: int
    expires_at: datetime

    def __post_init__(self):
        if (any(type(value) is not int for value in (
                    self.reservation_id, self.publication_id, self.applicant_id,
                    self.owner_id, self.capacity, self.version))
                or self.reservation_id < 1
                or self.publication_id < 1 or self.applicant_id < 1 or self.owner_id < 1
                or self.capacity < 1 or self.version < 0
                or self.expires_at.tzinfo is None
                or self.expires_at <= datetime.now(timezone.utc)):
            raise RuleViolation("La reserva de capacidad no es válida.", 409)


def validate_admission(event_key, publication_id, application_id, applicant_id):
    if not EVENT_KEY.fullmatch(event_key) or int(event_key.split(":")[1]) != application_id:
        raise RuleViolation("La clave de incorporación no coincide con la postulación.")
    if min(publication_id, application_id, applicant_id) < 1:
        raise RuleViolation("Los identificadores de incorporación no son válidos.")


def validate_message(content, client_message_id):
    try:
        parsed_id = UUID(client_message_id)
    except (TypeError, ValueError, AttributeError):
        raise RuleViolation("El identificador del mensaje no es válido.") from None
    if str(parsed_id) != client_message_id:
        raise RuleViolation("El identificador del mensaje no es válido.")
    if not isinstance(content, str) or "\x00" in content:
        raise RuleViolation("El mensaje no es válido.")
    content = content.strip()
    if not content or len(content) > MESSAGE_LIMIT:
        raise RuleViolation("El mensaje debe tener entre 1 y 2000 caracteres.")
    return content


def validate_removal(reason, confirmation):
    if confirmation is not True:
        raise RuleViolation("Confirma el retiro del integrante.")
    if not isinstance(reason, str) or "\x00" in reason:
        raise RuleViolation("El motivo del retiro no es válido.")
    reason = reason.strip()
    if not reason or len(reason) > 1000:
        raise RuleViolation("El motivo debe tener entre 1 y 1000 caracteres.")
    return reason
