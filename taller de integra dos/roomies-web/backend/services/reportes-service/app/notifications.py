"""Entrega reintentable de avisos de moderación a Auth/Users."""
import httpx

from backend.service_runtime.contracts import DependencyUnavailable
from backend.service_runtime.reporting_security import report_service_token
from backend.service_runtime.settings import service_url


class NotificationDelivery:
    def __init__(self, repository, transport=None):
        self.repository = repository
        self.transport = transport

    def deliver_next(self):
        row = self.repository.next_notification()
        if row is None:
            return False
        action_id = row["id_actuacion"]
        key = f"reporte_actualizado:{action_id}"
        payload = {name: row[name] for name in ("id_usuario", "referencia_id", "estado")}
        try:
            url = service_url("AUTH_USERS_UPSTREAM_URL", docker_hosts=("auth-users",))
            token = report_service_token("auth-users", "REPORTES_AUTH_JWT_KEY")
            with httpx.Client(timeout=3, trust_env=False, follow_redirects=False, transport=self.transport) as client:
                response = client.post(
                    url + "/internal/notificaciones",
                    headers={"Authorization": f"Bearer {token}", "Idempotency-Key": key},
                    json={**payload, "event_key": key, "tipo": "reporte_actualizado"},
                )
            response.raise_for_status()
            if response.json() == {"success": True}:
                self.repository.mark_delivered(action_id)
        except (DependencyUnavailable, httpx.HTTPError, ValueError):
            # La siguiente fecha de intento se reservó antes de enviar.
            pass
        return True
