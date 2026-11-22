"""Consultas directas a los dueños de los datos utilizados para autorizar."""
import httpx

from backend.service_runtime.contracts import DependencyUnavailable
from backend.service_runtime.reporting_security import report_service_token
from backend.service_runtime.settings import service_url


class Relationships:
    def __init__(self, transport=None):
        self.transport = transport

    def _read(self, service, variable, key_variable, path, *, params=None, allow_missing=False):
        token = report_service_token(service, key_variable)
        url = service_url(variable, docker_hosts=(service,))
        try:
            with httpx.Client(timeout=3, trust_env=False, follow_redirects=False, transport=self.transport) as client:
                response = client.get(url + path, params=params, headers={"Authorization": f"Bearer {token}"})
            if response.status_code == 404 and allow_missing and response.json() == {"codigo": "PUBLICACION_NO_ENCONTRADA"}:
                return None
            response.raise_for_status()
            payload = response.json()
            if not isinstance(payload, dict):
                raise ValueError()
            return payload
        except (httpx.HTTPError, ValueError):
            raise DependencyUnavailable() from None

    def publication_owner(self, publication_id):
        payload = self._read(
            "listado-applications", "LISTADO_UPSTREAM_URL", "REPORTES_LISTADO_JWT_KEY",
            f"/internal/publicaciones/{publication_id}",
            allow_missing=True,
        )
        if payload is None:
            return None
        owner = payload.get("id_propietario")
        reported = payload.get("id_publicacion")
        if type(owner) is not int or owner < 1 or type(reported) is not int or reported != publication_id:
            raise DependencyUnavailable()
        return owner

    def related_users(self, actor_id, target_id):
        pair = {"a": actor_id, "b": target_id}
        match = self._read(
            "match-conexion", "MATCH_UPSTREAM_URL", "REPORTES_MATCH_JWT_KEY", "/internal/conexiones/relacion", params=pair,
        )
        accepted = match.get("existio")
        if type(accepted) is not bool:
            raise DependencyUnavailable()
        if accepted:
            return True
        rental = self._read(
            "convivencia-mensajeria", "CONVIVENCIA_UPSTREAM_URL", "REPORTES_CONVIVENCIA_JWT_KEY",
            "/internal/convivencia/relacion", params=pair,
        )
        overlap = rental.get("coincidio")
        if type(overlap) is not bool:
            raise DependencyUnavailable()
        return overlap
