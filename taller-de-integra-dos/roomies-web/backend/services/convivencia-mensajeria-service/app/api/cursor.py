import base64
from datetime import datetime
import hashlib
import hmac
import json
import os

from backend.service_runtime.contracts import DependencyUnavailable, RuleViolation


def _secret():
    value = os.environ.get("ROOMIES_CURSOR_SECRET", "")
    if len(value) < 32:
        raise DependencyUnavailable("Cursor de mensajes no configurado.")
    return value.encode("utf-8")


def _encode(kind, context_id, user_id, created_at, item_id):
    payload = json.dumps(
        {
            "v": 1,
            "c": f"{kind}:{context_id}",
            "u": user_id,
            "t": created_at.isoformat(),
            "i": item_id,
        },
        separators=(",", ":"),
        sort_keys=True,
    ).encode("utf-8")
    signature = hmac.new(_secret(), payload, hashlib.sha256).digest()
    return base64.urlsafe_b64encode(payload + b"." + signature).rstrip(b"=").decode("ascii")


def _decode(value, kind, context_id, user_id):
    try:
        if not value or len(value) > 2048:
            raise ValueError()
        raw = base64.urlsafe_b64decode(value + "=" * (-len(value) % 4))
        if len(raw) < 33 or raw[-33:-32] != b".":
            raise ValueError()
        payload, signature = raw[:-33], raw[-32:]
        expected = hmac.new(_secret(), payload, hashlib.sha256).digest()
        if not hmac.compare_digest(signature, expected):
            raise ValueError()
        data = json.loads(payload)
        moment = datetime.fromisoformat(data["t"])
        if (data["v"] != 1 or not isinstance(data["c"], str)
                or type(data["u"]) is not int or type(data["i"]) is not int
                or data["c"] != f"{kind}:{context_id}" or data["u"] != user_id
                or data["i"] < 1 or moment.tzinfo is None):
            raise ValueError()
        return moment, data["i"]
    except DependencyUnavailable:
        raise
    except (ValueError, TypeError, KeyError, UnicodeError, json.JSONDecodeError):
        raise RuleViolation("Cursor inválido o de otra conversación.", 422) from None


def encode(conversation_id, user_id, message):
    return _encode(
        "mensajes",
        conversation_id,
        user_id,
        message["creado_en"],
        message["id_mensaje"],
    )


def decode(value, conversation_id, user_id):
    return _decode(value, "mensajes", conversation_id, user_id)


def encode_members(rental_id, user_id, member):
    return _encode(
        "integrantes",
        rental_id,
        user_id,
        member["ingreso_en"],
        member["id_pertenencia"],
    )


def decode_members(value, rental_id, user_id):
    return _decode(value, "integrantes", rental_id, user_id)


def encode_conversations(user_id, conversation):
    return _encode(
        "conversaciones",
        0,
        user_id,
        conversation["creada_en"],
        conversation["id_conversacion"],
    )


def decode_conversations(value, user_id):
    return _decode(value, "conversaciones", 0, user_id)
