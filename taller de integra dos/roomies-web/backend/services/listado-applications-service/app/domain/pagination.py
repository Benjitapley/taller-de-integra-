"""Cursor firmado: el cliente debe devolverlo sin interpretar ni modificarlo."""
import base64
from datetime import datetime
import hashlib
import hmac
import json
import os
from backend.service_runtime.contracts import RuleViolation, DependencyUnavailable


def _key():
    key = os.environ.get("ROOMIES_CURSOR_SECRET", "")
    if len(key) < 32:
        raise DependencyUnavailable("Falta configurar la firma de paginación.")
    return key.encode()


def context(filters, owner=None):
    values = {key: value for key, value in filters.items() if key not in {"cursor", "limite", "after"} and value is not None}
    return hashlib.sha256(json.dumps({"lista": "publicaciones", "owner": owner, "filtros": values}, sort_keys=True, default=str, separators=(",", ":")).encode()).hexdigest()


def encode(row, scope):
    payload = json.dumps([1, scope, row["fecha_publicacion"].isoformat(), row["id_publicacion"]], separators=(",", ":")).encode()
    return base64.urlsafe_b64encode(payload + hmac.digest(_key(), payload, "sha256")).decode().rstrip("=")


def decode(cursor, scope):
    try:
        if not isinstance(cursor, str) or not 1 <= len(cursor) <= 1024:
            raise ValueError()
        raw = base64.b64decode(cursor + "=" * (-len(cursor) % 4), altchars=b"-_", validate=True)
        payload, signature = raw[:-32], raw[-32:]
        if not hmac.compare_digest(signature, hmac.digest(_key(), payload, "sha256")):
            raise ValueError()
        version, found, timestamp, id = json.loads(payload)
        date = datetime.fromisoformat(timestamp)
        if version != 1 or found != scope or date.tzinfo is None or type(id) is not int or id < 1:
            raise ValueError()
        return date, id
    except (ValueError, TypeError, IndexError, UnicodeDecodeError):
        raise RuleViolation("Cursor inválido para estos filtros o esta cuenta.") from None
