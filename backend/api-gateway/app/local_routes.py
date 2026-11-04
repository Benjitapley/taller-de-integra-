"""Contrato local de enrutamiento; solo destinos del operador y rutas permitidas."""
import asyncio
import re
from fastapi import Request
from starlette.responses import JSONResponse
from app.proxy import forward_to,bounded_body,BodyTooLarge

ROUTES=[
 (r"/local/v1/sesion/revocar",{"POST"},"upstream"),
 (r"/local/v1/perfil/inicializacion",{"POST"},"upstream"),
 (r"/local/v1/perfil",{"GET","PUT","PATCH"},"upstream"),
 (r"/local/v1/notificaciones",{"GET"},"upstream"),
 (r"/api/publicaciones(?:/buscar)?",{"GET","POST"},"listado_upstream"),
 (r"/api/mis-publicaciones",{"GET"},"listado_upstream"),
 (r"/local/v1/publicaciones/resumen",{"GET"},"listado_upstream"),
 (r"/api/publicaciones/[1-9][0-9]*",{"GET","PUT"},"listado_upstream"),
 (r"/api/publicaciones/[1-9][0-9]*/(?:detalle|cupos|postulantes)",{"GET"},"listado_upstream"),
 (r"/api/publicaciones/[1-9][0-9]*/cerrar",{"PATCH"},"listado_upstream"),
 (r"/api/publicaciones/[1-9][0-9]*/postulaciones",{"POST"},"listado_upstream"),
 (r"/api/postulaciones/mias",{"GET"},"listado_upstream"),
 (r"/api/postulaciones/[1-9][0-9]*/estado",{"PATCH"},"listado_upstream"),
 (r"/api/admin/publicaciones",{"GET"},"listado_upstream"),
 (r"/conexiones/",{"POST"},"match_upstream"),
 (r"/conexiones/[1-9][0-9]*",{"PUT","DELETE"},"match_upstream"),
 (r"/conexiones/(?:recibidas|enviadas|aceptadas)",{"GET"},"match_upstream"),
 (r"/conexiones/recibidas/[1-9][0-9]*",{"GET"},"match_upstream"),
 (r"/conexiones/usuarios/(?:buscar|[1-9][0-9]*)",{"GET"},"match_upstream"),
 (r"/conexiones/publicaciones/buscar",{"GET"},"match_upstream"),
 (r"/imagenes/u_[a-f0-9]{32}\.(?:jpg|png|webp)",{"GET"},"upstream"),
 (r"/imagenes/p_[a-f0-9]{32}\.(?:jpg|png|webp)",{"GET"},"listado_upstream"),
]


def reply(status,body):
    return JSONResponse(body,status_code=status,headers={"Cache-Control":"no-store"})


async def summary(request):
    config=request.app.state.settings
    try:
        async with asyncio.timeout(config.client_body_timeout):
            body=await bounded_body(request.stream(),config.max_request_bytes)
    except BodyTooLarge: return reply(413,{"detail":"Solicitud demasiado grande."})
    except TimeoutError: return reply(408,{"detail":"Tiempo de recepción agotado."})
    targets=[(config.upstream,"/internal/v1/resumen","usuarios"),
             (config.listado_upstream,"/internal/v1/resumen","publicaciones"),
             (config.match_upstream,"/conexiones/internal/v1/resumen","conexiones")]
    async def count(target,path,key):
        async def receive(): return {"type":"http.request","body":body,"more_body":False}
        response=await forward_to(Request(request.scope,receive),target,path)
        if response.status_code!=200:
            return response,None
        import json
        value=json.loads(response.body)
        if not isinstance(value,dict) or type(value.get(key)) is not int or value[key]<0:
            raise ValueError()
        return None,(key,value[key])
    try:
        results=await asyncio.gather(*(count(*target) for target in targets))
        for error,item in results:
            if error is not None: return error
        return reply(200,dict(item for error,item in results))
    except Exception:
        return reply(503,{"detail":"No se pudo consultar el resumen."})


async def dispatch(request:Request):
    raw=request.scope.get("raw_path",b"")
    path=request.url.path
    if b"%" in raw or b"\\" in raw or "//" in path or ".." in path:
        return reply(404,{"detail":"Ruta no disponible."})
    if path=="/api/admin/resumen":
        if request.method!="GET": return reply(405,{"detail":"Método no permitido."})
        return await summary(request)
    for pattern,methods,setting in ROUTES:
        if re.fullmatch(pattern,path):
            if request.method not in methods:
                return reply(405,{"detail":"Método no permitido."})
            return await forward_to(request,getattr(request.app.state.settings,setting),path)
    return reply(404,{"detail":"Ruta no disponible."})
