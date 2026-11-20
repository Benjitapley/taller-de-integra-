from datetime import datetime

import jwt

from backend.service_runtime.contracts import RuleViolation
from backend.service_runtime.reporting_security import service_key
from app.models import MAX_ID

TRANSITIONS = {
    "Pendiente": {"En_Revision", "Descartado"},
    "En_Revision": {"Resuelto", "Descartado"},
}


def check_transition(before, after):
    if after not in TRANSITIONS.get(before, ()):
        raise RuleViolation("Transición de estado no permitida. Actualiza el reporte.", 409)


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
        return self._page(actor_id, limit, cursor, "mis-reportes",
                          lambda size, before: self.repository.mine(actor_id, size, before))

    def admin_queue(self, admin_id, limit, cursor, status, kind):
        return self._page(admin_id, limit, cursor, "admin-reportes",
                          lambda size, before: self.repository.moderation_queue(status, kind, size, before),
                          {"estado": status, "tipo": kind})

    def detail(self, report_id):
        row = self.repository.detail(report_id)
        if row is None:
            raise RuleViolation("Reporte no encontrado.", 404)
        return row

    def review(self, report_id, administrator_id, data):
        row = self.repository.review(report_id, administrator_id, data, check_transition)
        if row is None:
            raise RuleViolation("Reporte no encontrado.", 404)
        return row

    @staticmethod
    def _page(actor_id, limit, cursor, audience, load, filters=None):
        key = service_key("REPORTES_CURSOR_SECRET")
        before = None
        if cursor is not None:
            try:
                data = jwt.decode(cursor, key, algorithms=["HS256"], audience=audience)
                if data["sub"] != str(actor_id) or data.get("filtros") != filters or type(data["id"]) is not int or not 0 < data["id"] <= MAX_ID:
                    raise ValueError()
                date = datetime.fromisoformat(data["fecha"])
                if date.tzinfo is None:
                    raise ValueError()
                before = (date, data["id"])
            except (jwt.PyJWTError, TypeError, ValueError, KeyError):
                raise RuleViolation("Cursor inválido.", 422) from None
        rows = load(limit + 1, before)
        items = rows[:limit]
        next_cursor = None
        if len(rows) > limit:
            last = items[-1]
            claims = {"sub": str(actor_id), "aud": audience, "fecha": last["fecha"].isoformat(), "id": last["id_reporte"]}
            if filters is not None:
                claims["filtros"] = filters
            next_cursor = jwt.encode(claims, key, algorithm="HS256")
        return {"items": items, "siguiente_cursor": next_cursor}
