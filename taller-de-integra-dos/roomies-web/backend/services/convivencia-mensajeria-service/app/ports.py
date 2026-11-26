"""Puertos HTTP propuestos: el proveedor de reservas de Listado está pendiente."""
import os
from typing import Protocol
from uuid import UUID

import httpx
from pydantic import ValidationError

from backend.service_runtime.settings import service_url
from app.models import Reservation, OccupancyConfirmation, ServiceError, unavailable


class IdentityPort(Protocol):
    def enabled(self, user_id: int) -> bool: ...


class PublicationPort(Protocol):
    def reserve(self, key: UUID, payload: dict) -> dict: ...
    def confirm(self, key: UUID, reservation: dict) -> None: ...
    def release(self, key: UUID, reservation: dict) -> None: ...


def headers(key=None):
    token = os.environ.get("ROOMIES_INTERNAL_TOKEN", "")
    if len(token) < 32 or not token.isascii():
        raise unavailable()
    result = {"X-Roomies-Service": token}
    if key is not None:
        result["Idempotency-Key"] = str(key)
    return result


class HttpIdentity:
    def enabled(self, user_id):
        try:
            url = service_url("AUTH_USERS_UPSTREAM_URL", docker_hosts=("auth-users",))
            with httpx.Client(timeout=3, trust_env=False, follow_redirects=False) as client:
                response = client.get(f"{url}/internal/v1/usuarios/{user_id}/habilitacion", headers=headers())
            response.raise_for_status()
            value = response.json()
            if set(value) != {"id_usuario", "habilitado"} or type(value["id_usuario"]) is not int or value["id_usuario"] != user_id or type(value["habilitado"]) is not bool:
                raise ValueError()
            return value["habilitado"]
        except Exception:
            raise unavailable() from None


class HttpPublications:
    def owner(self, publication_id):
        response = self.request("GET", f"/internal/convivencia/publicaciones/{publication_id}", None)
        try:
            value = response.json()["id_propietario"]
            if type(value) is not int or value < 1:
                raise ValueError()
            return value
        except (KeyError, ValueError, TypeError):
            raise unavailable() from None

    def expulsion_occupancy(self, publication_id, projection):
        self.request("PUT", f"/internal/convivencia/publicaciones/{publication_id}/ocupacion", None, projection)

    def request(self, method, path, key, payload=None):
        try:
            url = service_url("LISTADO_UPSTREAM_URL", docker_hosts=("listado", "listado-applications"))
            with httpx.Client(timeout=3, trust_env=False, follow_redirects=False) as client:
                response = client.request(method, url + path, headers=headers(key), json=payload)
            if response.status_code == 409:
                value = response.json()
                messages = {
                    "NO_CAPACITY": "No quedan cupos disponibles.",
                    "CAPACITY_VERSION_CONFLICT": "La versión de capacidad no coincide.",
                    "APPLICATION_NOT_ACCEPTED": "La postulación no tiene una intención de admisión vigente.",
                    "PUBLICATION_CLOSED": "La publicación está cerrada.",
                    "IDEMPOTENCY_CONFLICT": "La clave corresponde a otra operación.",
                    "APPLICATION_ALREADY_PROCESSED": "La postulación ya fue incorporada.",
                }
                if value.get("code") in messages:
                    raise ServiceError(value["code"], messages[value["code"]])
            response.raise_for_status()
            return response
        except ServiceError:
            raise
        except Exception:
            raise unavailable() from None

    def reserve(self, key, payload):
        response = self.request("POST", f"/internal/publicaciones/{payload['id_publicacion']}/reservas", key, {**payload, "id_operacion": str(key)})
        try:
            reservation = Reservation.model_validate(response.json())
            if reservation.model_dump(exclude={"id_reserva", "cupos_totales"}) != payload:
                raise ValueError()
            return reservation.model_dump(mode="json")
        except (ValidationError, ValueError):
            raise unavailable() from None

    def confirm(self, key, reservation):
        try:
            confirmation = OccupancyConfirmation.model_validate(reservation["confirmacion"]).model_dump()
        except (KeyError, ValidationError, TypeError):
            raise unavailable() from None
        path = f"/internal/publicaciones/{reservation['id_publicacion']}/reservas/{reservation['id_reserva']}/confirmacion"
        self.request("PUT", path, key, confirmation)

    def release(self, key, reservation):
        path = f"/internal/publicaciones/{reservation['id_publicacion']}/reservas/{reservation['id_reserva']}"
        self.request("DELETE", path, key)
