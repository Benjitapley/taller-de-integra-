"""Dependencias entre dominios exclusivamente por HTTP."""
import httpx
from backend.service_runtime.settings import service_url
from backend.service_runtime.contracts import DependencyUnavailable


class HttpProfiles:
    def search(self,filters):
        try:
            url=service_url("AUTH_USERS_UPSTREAM_URL",docker_hosts=("auth-users",))
            with httpx.Client(timeout=5,trust_env=False,follow_redirects=False) as client:
                response=client.get(url+"/local/v1/usuarios/publicos",params=filters)
            response.raise_for_status()
            result=response.json()
            if not isinstance(result,list) or any(not isinstance(row,dict) or type(row.get("id_usuario_PK")) is not int for row in result):
                raise ValueError()
            fields={"id_usuario_PK","nombre","edad","presupuesto","zona_interes","ocupacion"}
            return [{k:v for k,v in row.items() if k in fields} for row in result]
        except Exception:
            raise DependencyUnavailable() from None


class HttpPublications:
    def search(self,filters):
        try:
            url=service_url("LISTADO_UPSTREAM_URL",docker_hosts=("listado",))
            with httpx.Client(timeout=5,trust_env=False,follow_redirects=False) as client:
                response=client.get(url+"/api/publicaciones",params=filters)
            response.raise_for_status()
            return [{"id_publicacion_PK":r["id"],"titulo":r["titulo"],"precio":r["precio"],"ubicacion":r["ubicacion"],"tipo":r["tipo"],"cupos_totales":r["cupos_totales"],"tipo_vivienda":r["tipo_vivienda"],"mascotas":r["mascota"]} for r in response.json()]
        except Exception:
            raise DependencyUnavailable() from None
