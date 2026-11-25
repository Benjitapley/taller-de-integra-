"""Puertos de ocupación y notificación; nunca consultan tablas de otros dominios."""
import os
from uuid import UUID
import httpx
from backend.service_runtime.contracts import DependencyUnavailable, RuleViolation
from backend.service_runtime.notifications import send_notification
from backend.service_runtime.settings import service_url


INCORPORATION_ERRORS = {
    "USER_ALREADY_ACTIVE": (409, "El usuario ya tiene una pertenencia activa."),
    "IDEMPOTENCY_CONFLICT": (409, "La clave de reintento corresponde a otra solicitud."),
    "CAPACITY_VERSION_CONFLICT": (409, "La version de capacidad cambio; consulta Listado."),
    "NO_CAPACITY": (409, "No queda capacidad para incorporar al usuario."),
    "APPLICATION_ALREADY_PROCESSED": (409, "La postulacion ya tiene otra incorporacion."),
    "APPLICATION_NOT_ACCEPTED": (409, "La postulacion todavia no esta aceptada."),
    "PUBLICATION_CLOSED": (409, "La publicacion esta cerrada."),
    "USER_NOT_ENABLED": (403, "El usuario no esta habilitado para incorporarse."),
    "FORBIDDEN": (403, "Servicio no autorizado para incorporar."),
    "INVALID_REQUEST": (422, "Solicitud de incorporacion invalida."),
}


class IncorporationRejected(RuleViolation):
    def __init__(self, code):
        status, message = INCORPORATION_ERRORS[code]
        super().__init__(message, status)
        self.code = code


class HttpIncorporations:
    """Contrato de incorporación: solo el recibo validado permite confirmar Aceptada."""

    def incorporate(self, payload, idempotency_key):
        fields = {"id_postulacion", "id_publicacion", "id_usuario", "version_capacidad"}
        try:
            if (not isinstance(payload, dict) or set(payload) != fields
                    or any(type(value) is not int or not 1 <= value <= 9223372036854775807 for value in payload.values())
                    or not isinstance(idempotency_key, str) or str(UUID(idempotency_key)) != idempotency_key):
                raise ValueError()
        except (ValueError, TypeError, AttributeError):
            raise IncorporationRejected("INVALID_REQUEST") from None
        key = os.environ.get("ROOMIES_INTERNAL_TOKEN", "")
        if len(key) < 32 or not key.isascii():
            raise DependencyUnavailable()
        url = service_url("CONVIVENCIA_UPSTREAM_URL", docker_hosts=("convivencia-mensajeria",))
        try:
            with httpx.Client(timeout=5, trust_env=False, follow_redirects=False) as client:
                response = client.post(url + "/internal/incorporaciones", json=payload,
                                       headers={"X-Roomies-Service": key, "Idempotency-Key": idempotency_key})
            value = response.json()
            if response.status_code != 201:
                code = value.get("code") if isinstance(value, dict) else None
                if code in INCORPORATION_ERRORS and response.status_code == INCORPORATION_ERRORS[code][0]:
                    raise IncorporationRejected(code)
                raise DependencyUnavailable()
            if (not isinstance(value, dict)
                    or set(value) != {"id_incorporacion", "id_arriendo", "id_publicacion", "id_usuario", "estado", "confirmacion_publicacion"}
                    or value["id_incorporacion"] != idempotency_key
                    or type(value["id_arriendo"]) is not int or not 1 <= value["id_arriendo"] <= 9223372036854775807
                    or any(type(value[name]) is not int or value[name] != payload[name] for name in ("id_publicacion", "id_usuario"))
                    or value["estado"] != "Activa" or value["confirmacion_publicacion"] != "Pendiente"
                    or response.headers.get("Idempotency-Replayed") not in {"true", "false"}):
                raise ValueError()
            return value
        except IncorporationRejected:
            raise
        except Exception:
            raise DependencyUnavailable() from None


class UnavailableOccupancy:
    def active_members(self,publication_id):
        raise DependencyUnavailable("Convivencia pertenece a la siguiente etapa.")


class HttpOwners:
    def exists(self, user_id):
        return any(row.get("id_usuario_PK") == user_id for row in self._profiles({"ids": str(user_id)}))

    def summaries(self, user_ids):
        if not user_ids:
            return {}
        requested = set(user_ids)
        rows = self._profiles({"ids": ",".join(map(str, user_ids)), "incluir_foto": "true"})
        return {
            row["id_usuario_PK"]: {"id_usuario": row["id_usuario_PK"], "nombre": row["nombre"],
                                   "foto": row.get("foto_perfil") if isinstance(row.get("foto_perfil"), str) else None}
            for row in rows
            if type(row.get("id_usuario_PK")) is int and row["id_usuario_PK"] in requested
            and isinstance(row.get("nombre"), str)
        }

    def _profiles(self, params):
        url = service_url("AUTH_USERS_UPSTREAM_URL", docker_hosts=("auth-users",))
        try:
            with httpx.Client(timeout=3, trust_env=False, follow_redirects=False) as client:
                response = client.get(url + "/local/v1/usuarios/publicos", params=params)
                response.raise_for_status()
                rows = response.json()
                if not isinstance(rows, list) or any(not isinstance(row, dict) for row in rows):
                    raise ValueError()
                return rows
        except Exception:
            raise DependencyUnavailable() from None


class HttpNotifications:
    def send(self,event):
        if os.environ.get("LISTADO_AUTH_JWT_KEY"):
            send_notification({**event, "tipo": "postulacion_resultado"})
            return
        key=os.environ.get("ROOMIES_INTERNAL_TOKEN", "")
        if len(key)<32:
            raise DependencyUnavailable()
        url=service_url("AUTH_USERS_UPSTREAM_URL",docker_hosts=("auth-users",))
        with httpx.Client(timeout=3,trust_env=False,follow_redirects=False) as client:
            response=client.post(url+"/internal/v1/notificaciones",json=event,headers={"X-Roomies-Service":key})
            response.raise_for_status()
            if response.json() != {"success": True}:
                raise DependencyUnavailable()
