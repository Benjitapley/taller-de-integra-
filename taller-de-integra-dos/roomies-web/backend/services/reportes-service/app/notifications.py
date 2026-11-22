"""Entrega reintentable de avisos de moderación a Auth/Users."""
from backend.service_runtime.contracts import DependencyUnavailable
from backend.service_runtime.notifications import send_notification


class NotificationDelivery:
    def __init__(self, repository, transport=None):
        self.repository = repository
        self.transport = transport

    def deliver_next(self):
        row = self.repository.next_notification()
        if row is None:
            return False
        action_id = row["id_actuacion"]
        payload = {name: row[name] for name in ("id_usuario", "referencia_id", "estado")}
        try:
            send_notification({**payload, "event_key": f"reporte_actualizado:{action_id}", "tipo": "reporte_actualizado"},
                              transport=self.transport)
        except DependencyUnavailable:
            return True  # La siguiente fecha de intento se reservó antes de enviar.
        self.repository.mark_delivered(action_id)
        return True
