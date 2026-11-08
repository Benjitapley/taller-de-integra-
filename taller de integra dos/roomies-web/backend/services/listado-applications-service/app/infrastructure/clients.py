"""Puertos de ocupación y notificación; nunca consultan tablas de otros dominios."""
import os
import httpx
from backend.service_runtime.contracts import DependencyUnavailable
from backend.service_runtime.settings import service_url


class UnavailableOccupancy:
    def active_members(self,publication_id):
        raise DependencyUnavailable("Convivencia pertenece a la siguiente etapa.")


class HttpOwners:
    def exists(self, user_id):
        url = service_url("AUTH_USERS_UPSTREAM_URL", docker_hosts=("auth-users",))
        try:
            with httpx.Client(timeout=3, trust_env=False, follow_redirects=False) as client:
                response = client.get(url + "/local/v1/usuarios/publicos", params={"ids": str(user_id)})
                response.raise_for_status()
                rows = response.json()
                if not isinstance(rows, list): raise ValueError()
                return any(row.get("id_usuario_PK") == user_id for row in rows)
        except Exception:
            raise DependencyUnavailable() from None


class HttpNotifications:
    def send(self,event):
        key=os.environ.get("ROOMIES_INTERNAL_TOKEN", "")
        if len(key)<32:
            raise DependencyUnavailable()
        url=service_url("AUTH_USERS_UPSTREAM_URL",docker_hosts=("auth-users",))
        with httpx.Client(timeout=3,trust_env=False,follow_redirects=False) as client:
            response=client.post(url+"/internal/v1/notificaciones",json=event,headers={"X-Roomies-Service":key})
            response.raise_for_status()


