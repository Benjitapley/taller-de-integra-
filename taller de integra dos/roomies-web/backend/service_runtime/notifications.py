"""Contrato interno de los avisos de usuario que recibe Auth/Users."""
import httpx

from .contracts import DependencyUnavailable
from .reporting_security import service_token
from .settings import service_url


PRODUCERS = {
    "postulacion_resultado": ("listado-applications", "LISTADO_AUTH_JWT_KEY"),
    "expulsion": ("convivencia-mensajeria", "CONVIVENCIA_AUTH_JWT_KEY"),
    "reporte_actualizado": ("reportes", "REPORTES_AUTH_JWT_KEY"),
}


def send_notification(event, *, transport=None):
    issuer, variable = PRODUCERS[event["tipo"]]
    token = service_token(issuer, "auth-users", variable)
    url = service_url("AUTH_USERS_UPSTREAM_URL", docker_hosts=("auth-users",))
    try:
        with httpx.Client(timeout=3, trust_env=False, follow_redirects=False, transport=transport) as client:
            response = client.post(
                url + "/internal/notificaciones",
                headers={"Authorization": f"Bearer {token}", "Idempotency-Key": event["event_key"]},
                json=event,
            )
        response.raise_for_status()
        if response.json() != {"success": True}:
            raise ValueError()
    except (httpx.HTTPError, ValueError):
        raise DependencyUnavailable() from None
