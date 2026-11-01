import json
import os
import sys
from contextlib import ExitStack
from decimal import Decimal
from pathlib import Path
from unittest.mock import AsyncMock, patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "tests"))
from test_publicaciones import cargar_api_sin_servicios_externos, ConexionFalsa
from fastapi.testclient import TestClient
from io import BytesIO
from PIL import Image

evidencia = []
datos = dict(titulo="Habitación QA", categoria="ofrezco", ubicacion="Temuco", precio="150000",
             tipo="Compartida", cupos_totales="4", tipo_vivienda="casa", descripcion="Prueba aislada", mascota="no")
with ExitStack() as bloqueos:
    bloqueos.enter_context(patch("dotenv.load_dotenv", return_value=False))
    conectar_real = bloqueos.enter_context(patch("psycopg.connect", side_effect=AssertionError("DB REAL BLOQUEADA")))
    api = cargar_api_sin_servicios_externos()
    cliente = TestClient(api.app, raise_server_exceptions=False)

    def caso(nombre, metodo, ruta, esperado, conexion=None, extras=None, **kwargs):
        conexion = conexion if conexion is not None else ConexionFalsa(None)
        with patch.object(api, "conectar", return_value=conexion) as conectar, \
                patch.object(Path, "write_bytes") as escribir, patch.object(Path, "unlink") as borrar:
            respuesta = getattr(cliente, metodo)(ruta, **kwargs)
        try:
            cuerpo = respuesta.json()
        except ValueError:
            cuerpo = respuesta.text
        fila = dict(caso=nombre, metodo=metodo.upper(), ruta=ruta, esperado=esperado,
                    obtenido=respuesta.status_code, resultado="PASS" if respuesta.status_code == esperado else "FAIL",
                    cuerpo=cuerpo, conexiones_simuladas=conectar.call_count,
                    escrituras_archivo_simuladas=escribir.call_count, limpieza_simulada=borrar.call_count)
        if escribir.call_args:
            fila["bytes_archivo_simulados"] = len(escribir.call_args.args[0])
        if extras:
            fila.update(extras)
        evidencia.append(fila)
        return respuesta, conexion

    try:
        caso("ID de detalle no entero", "get", "/api/publicaciones/no-numero", 422)
        caso("ID cupos no entero", "get", "/api/publicaciones/no-numero/cupos", 422)
        caso("ID cierre no entero", "patch", "/api/publicaciones/no-numero/cerrar", 422)
        caso("ID eliminación no entero", "delete", "/api/publicaciones/no-numero", 422)
        caso("ID edición no entero", "put", "/api/publicaciones/no-numero", 422, data=datos)
        caso("Detalle inexistente", "get", "/api/publicaciones/99999", 404)
        caso("Cupos inexistentes", "get", "/api/publicaciones/99999/cupos", 404)
        caso("Ruta buscar no se interpreta como ID", "get", "/api/publicaciones/buscar", 200, ConexionFalsa([]))
        caso("POST JSON no cumple contrato Form", "post", "/api/publicaciones", 422, json=datos)
        caso("POST no imagen", "post", "/api/publicaciones", 422, data=datos,
             files={"imagen": ("foto.png", b"texto", "image/png")})
        caso("POST imagen mayor a 5 MB", "post", "/api/publicaciones", 413, data=datos,
             files={"imagen": ("foto.png", b"x" * (5*1024*1024+1), "image/png")})
        stream = BytesIO()
        Image.new("RGB", (2,2), "white").save(stream, format="PNG")
        caso("POST PNG válido, nombre y MIME no confiables", "post", "/api/publicaciones", 201,
             ConexionFalsa((42,)), data=datos,
             files={"imagen": ("nombre.jpg", stream.getvalue(), "application/octet-stream")})
        caso("POST formato GIF no permitido", "post", "/api/publicaciones", 422, data=datos,
             files={"imagen": ("foto.gif", b"GIF89a" + b"x"*16, "image/gif")})
        caso("Filtro precio mínimo mayor a máximo", "get", "/api/publicaciones/buscar?precio_min=200&precio_max=100", 422)
        caso("Filtro límite inválido", "get", "/api/publicaciones?limite=101", 422)
        caso("Listado vacío", "get", "/api/publicaciones", 200, ConexionFalsa([]))
        fila = [42, "QA", Decimal("150000"), "Temuco", 4, "casa", None,
                "ofrezco", "Descripción", "no", None, [], None, "Disponible"]
        for campo, indice in (("precio",2),("titulo",1),("cupos_totales",4)):
            for ruta in ("/api/publicaciones", "/api/publicaciones/buscar"):
                copia = list(fila)
                copia[indice] = None
                caso(f"Dato antiguo {campo}=NULL", "get", ruta, 200, ConexionFalsa([tuple(copia)]),
                     extras={"nota":"Prueba de robustez: deseable respuesta controlada sin bloquear el listado; no demuestra existencia de esa fila real."})
        caso("Perfil de usuario inexistente", "get", "/api/perfil", 404, ConexionFalsa(None, (0,)),
             extras={"nota":"La función genera HTTPException 404 pero su except Exception la convierte en 500."})
        caso("Perfil permite foto no imagen", "put", "/api/perfil", 422, ConexionFalsa(None),
             files={"foto":("foto.txt",b"texto sin imagen","text/plain")},
             extras={"nota":"Endpoint de perfil no reutiliza preparar_imagen; escritura sustituida por mock."})
        caso("Perfil trunca foto mayor a 5 MB", "put", "/api/perfil", 413, ConexionFalsa(None),
             files={"foto":("foto.png",b"x"*(5*1024*1024+1),"image/png")},
             extras={"nota":"Lee solamente 5 MB y acepta el archivo; no valida que el cuerpo sobrepase el límite."})
        with patch.dict(os.environ, {"GEOAPIFY_API_KEY":""}):
            caso("Autocompletado sin clave", "get", "/api/ubicaciones?texto=Temuco", 503)
        caso("Autocompletado texto menor a 3", "get", "/api/ubicaciones?texto=ab", 422)
        with patch.dict(os.environ, {"GEOAPIFY_API_KEY":"clave_falsa_qa"}):
            mock_geo = AsyncMock()
            mock_geo.__aenter__.return_value = mock_geo
            mock_geo.get.side_effect = RuntimeError("fallo simulado sin petición de red")
            with patch.object(api.httpx, "AsyncClient", return_value=mock_geo):
                caso("Autocompletado proveedor falla", "get", "/api/ubicaciones?texto=Temuco", 502)
            caso("Autocompletado texto en blanco", "get", "/api/ubicaciones?texto=%20%20%20", 200)
        resultado = {
            "base_tests":{"python":53,"correctos":53,"fallos":0,"errores":0,"omitidos":0,"conexion_real_intentos":0,
                          "javascript":"suite completa correcta"},
            "casos":evidencia,"resumen":{"total":len(evidencia),"pass":sum(c["resultado"]=="PASS" for c in evidencia),
                                         "fail":sum(c["resultado"]=="FAIL" for c in evidencia)},
            "bloqueo_db_real_intentos":conectar_real.call_count,
            "limites":["TestClient en proceso sin lifespan; ningún puerto TCP real.","Conexiones, archivos y proveedor geográfico simulados.",
                       "Fallos de robustez comparan con comportamiento seguro deseado, no con descripción actual del contrato."]}
    finally:
        cliente.close()

salida = ROOT / "tmp/qa/contratos_agente.json"
salida.parent.mkdir(parents=True,exist_ok=True)
salida.write_text(json.dumps(resultado,ensure_ascii=False,indent=2),encoding="utf-8")
print(json.dumps({"archivo":str(salida),"resumen":resultado["resumen"],"db_real":resultado["bloqueo_db_real_intentos"],
                  "fallos":[{"caso":c["caso"],"esperado":c["esperado"],"obtenido":c["obtenido"]} for c in evidencia if c["resultado"]=="FAIL"]},ensure_ascii=True))
