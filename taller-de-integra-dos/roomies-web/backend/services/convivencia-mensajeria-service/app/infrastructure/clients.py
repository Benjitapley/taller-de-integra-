"""Adaptador HTTP de capacidad; no consulta el esquema de Listado."""
from datetime import datetime
import os

import httpx

from app.domain.convivencia import Reservation
from backend.service_runtime.contracts import DependencyUnavailable, RuleViolation
from backend.service_runtime.settings import service_url


class HttpListingCapacity:
    def __init__(self, client_factory=httpx.Client):
        self.client_factory = client_factory

    def _request(self, method, path, *, json=None):
        token = os.environ.get("ROOMIES_INTERNAL_TOKEN", "")
        if len(token) < 32:
            raise DependencyUnavailable("Falta configurar la autenticación entre servicios.")
        url = service_url(
            "LISTADO_UPSTREAM_URL", docker_hosts=("listado", "listado-applications")
        )
        try:
            with self.client_factory(
                timeout=5, trust_env=False, follow_redirects=False
            ) as client:
                response = client.request(
                    method,
                    url + path,
                    json=json,
                    headers={"X-Roomies-Service": token},
                )
        except httpx.RequestError:
            raise DependencyUnavailable("No se pudo consultar Listado.") from None
        if response.status_code in {403, 404, 409}:
            messages = {
                403: "La operación no está autorizada por Listado.",
                404: "La publicación no existe.",
                409: "La capacidad de la publicación cambió.",
            }
            raise RuleViolation(messages[response.status_code], response.status_code)
        if response.status_code not in {200, 201, 204}:
            raise DependencyUnavailable("Listado no está disponible.")
        if response.status_code == 204:
            return None
        try:
            result = response.json()
        except ValueError:
            raise DependencyUnavailable("Listado devolvió una respuesta inválida.") from None
        if not isinstance(result, dict):
            raise DependencyUnavailable("Listado devolvió una respuesta inválida.")
        return result

    def reserve(self, event_key, publication_id, application_id, applicant_id):
        result = self._request(
            "POST",
            f"/internal/publicaciones/{publication_id}/reservas",
            json={
                "event_key": event_key,
                "id_postulacion": application_id,
                "id_usuario": applicant_id,
            },
        )
        try:
            reservation_id = result["id_reserva"]
            integer_fields = (
                result["id_publicacion"],
                result["id_usuario"],
                result["id_arrendador"],
                result["cupos_totales"],
                result["version_capacidad"],
            )
            if (type(reservation_id) is not int or reservation_id < 1
                    or any(type(value) is not int for value in integer_fields)):
                raise ValueError()
            reservation = Reservation(
                    reservation_id=reservation_id,
                publication_id=result["id_publicacion"],
                applicant_id=result["id_usuario"],
                owner_id=result["id_arrendador"],
                capacity=result["cupos_totales"],
                version=result["version_capacidad"],
                expires_at=datetime.fromisoformat(
                    result["expires_at"].replace("Z", "+00:00")
                ),
            )
        except (KeyError, TypeError, ValueError, AttributeError, RuleViolation):
            raise DependencyUnavailable("La respuesta de reserva no cumple el contrato.") from None
        return reservation

    def release(self, event_key, publication_id):
        self._request(
            "DELETE",
            f"/internal/publicaciones/{publication_id}/reservas",
            json={"event_key": event_key},
        )

    def publication(self, publication_id):
        result = self._request(
            "GET", f"/internal/publicaciones/{publication_id}"
        )
        if (type(result.get("id_publicacion")) is not int
                or type(result.get("id_usuario")) is not int):
            raise DependencyUnavailable("Listado devolvió una publicación inválida.")
        return {"owner_id": result["id_usuario"]}

    def publish_occupancy(self, event):
        payload = event["payload"]
        self._request(
            "PUT",
            f"/internal/publicaciones/{payload['id_publicacion']}/ocupacion",
            json=payload,
        )
