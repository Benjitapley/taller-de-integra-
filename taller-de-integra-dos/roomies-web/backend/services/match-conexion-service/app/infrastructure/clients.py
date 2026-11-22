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
            url=service_url("LISTADO_UPSTREAM_URL",docker_hosts=("listado", "listado-applications"))
            with httpx.Client(timeout=5,trust_env=False,follow_redirects=False) as client:
                response=client.get(url+"/api/publicaciones",params={"limite":100,**filters})
            response.raise_for_status()
            page=response.json()
            if not isinstance(page,dict) or not isinstance(page.get("items"),list) or "siguiente_cursor" not in page:
                raise ValueError()
            rows=page["items"]
            if len(rows)>100 or any(not isinstance(row,dict) or type(row.get("id_publicacion")) is not int or row["id_publicacion"]<1 for row in rows):
                raise ValueError()
            # shortcut: Match conserva su arreglo de hasta 100; retirar el alias cuando TI4 use el catálogo con cursor.
            return [{"id_publicacion_PK":r["id_publicacion"],"titulo":r["titulo"],"precio":r["precio"],"ubicacion":r["ubicacion"],"tipo":r["tipo"],"cupos_totales":r["cupos_totales"],"tipo_vivienda":r["tipo_vivienda"],"mascotas":r["mascota"]} for r in rows]
        except Exception:
            raise DependencyUnavailable() from None
