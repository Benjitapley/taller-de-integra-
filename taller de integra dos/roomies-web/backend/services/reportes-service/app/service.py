from datetime import datetime

import jwt

from backend.service_runtime.contracts import RuleViolation
from backend.service_runtime.reporting_security import service_key
from app.models import MAX_ID


class Reports:
    def __init__(self, repository, relationships):
        self.repository = repository
        self.relationships = relationships

    def create(self, actor_id, data):
        if data.id_usuario_reportado is not None:
            if actor_id == data.id_usuario_reportado or not self.relationships.related_users(actor_id, data.id_usuario_reportado):
                raise RuleViolation("Para reportar a una persona debes haber tenido una conexión aceptada o haber convivido con ella.", 403)
        else:
            owner = self.relationships.publication_owner(data.id_publicacion_reportada)
            if owner is None:
                raise RuleViolation("Publicación no encontrada.", 404)
            if owner == actor_id:
                raise RuleViolation("No puedes reportar tu propia publicación.", 403)
        return self.repository.create(actor_id, data)

    def mine(self, actor_id, limit, cursor):
        key = service_key("REPORTES_CURSOR_SECRET")
        before = None
        if cursor is not None:
            try:
                data = jwt.decode(cursor, key, algorithms=["HS256"], audience="mis-reportes")
                if data["sub"] != str(actor_id) or type(data["id"]) is not int or not 0 < data["id"] <= MAX_ID:
                    raise ValueError()
                date = datetime.fromisoformat(data["fecha"])
                if date.tzinfo is None:
                    raise ValueError()
                before = (date, data["id"])
            except (jwt.PyJWTError, TypeError, ValueError, KeyError):
                raise RuleViolation("Cursor inválido.", 422) from None
        rows = self.repository.mine(actor_id, limit + 1, before)
        items = rows[:limit]
        next_cursor = None
        if len(rows) > limit:
            last = items[-1]
            next_cursor = jwt.encode(
                {"sub": str(actor_id), "aud": "mis-reportes", "fecha": last["fecha"].isoformat(), "id": last["id_reporte"]},
                key, algorithm="HS256",
            )
        return {"items": items, "siguiente_cursor": next_cursor}
