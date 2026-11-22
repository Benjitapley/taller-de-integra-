"""Proyección paginada de avisos propios y compatibilidad con el tipo almacenado."""
from datetime import datetime

import jwt

from backend.service_runtime.contracts import RuleViolation
from backend.service_runtime.reporting_security import service_key


APPLICATION_TYPE = "Postulacion_Resultado"
MAX_ID = 9223372036854775807


def notification_page(repository, user_id, limit, cursor):
    key = service_key("AUTH_NOTIFICATIONS_CURSOR_SECRET")
    audience = "mis-notificaciones"
    before = None
    if cursor is not None:
        try:
            data = jwt.decode(cursor, key, algorithms=["HS256"], audience=audience)
            if data["sub"] != str(user_id) or type(data["id"]) is not int or not 0 < data["id"] <= MAX_ID:
                raise ValueError()
            date = datetime.fromisoformat(data["fecha"])
            if date.tzinfo is None:
                raise ValueError()
            before = (date, data["id"])
        except (jwt.PyJWTError, ValueError, TypeError, KeyError):
            raise RuleViolation("Cursor inválido.", 422) from None

    rows = repository.notification_page(user_id, limit + 1, before)
    items = rows[:limit]
    next_cursor = None
    if len(rows) > limit:
        last = items[-1]
        claims = {"sub": str(user_id), "aud": audience, "id": last["id"], "fecha": last["creado_en"].isoformat()}
        next_cursor = jwt.encode(claims, key, algorithm="HS256")
    return {
        "items": [
            {"id_notificacion": row["id"], "tipo": "postulacion_resultado" if row["tipo"] == APPLICATION_TYPE else row["tipo"],
             "referencia_id": row["referencia_id"], "fecha": row["creado_en"]}
            for row in items
        ],
        "siguiente_cursor": next_cursor,
    }
