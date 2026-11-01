"""Audita Swagger de publicaciones/auth con conexiones bloqueadas y datos simulados.

No inicia el lifespan ni accede a PostgreSQL. Sale con 1 si hay criterios FAIL.
"""

import argparse
import importlib.util
import json
import re
import sys
import types
from collections import Counter
from pathlib import Path
from unittest.mock import patch

from fastapi import APIRouter
from fastapi.testclient import TestClient


ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))


def cargar_aplicacion():
    def cargar(nombre, ruta):
        spec = importlib.util.spec_from_file_location(nombre, ROOT / ruta)
        modulo = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(modulo)
        return modulo

    auth = cargar("qa_auth_swagger", "auth_service/main.py")
    conexiones = types.ModuleType("match_conexion_service.routes")
    conexiones.router = APIRouter()
    with patch.dict(sys.modules, {
        "match_conexion_service.routes": conexiones,
        "auth_service.main": auth,
    }):
        api = cargar("qa_api_swagger", "main/main.py")
    return api


class ConexionSimulada:
    def __init__(self, resultado=None):
        self.resultado = resultado

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

    def execute(self, *args, **kwargs):
        return self

    def fetchone(self):
        return self.resultado


def auditar(api, cliente):
    casos = []

    def comprobar(identificador, criterio, correcto, esperado, observado):
        casos.append({
            "id": identificador, "criterio": criterio,
            "estado": "PASS" if correcto else "FAIL",
            "esperado": esperado, "observado": observado,
        })

    def informar(identificador, criterio, observado):
        casos.append({"id": identificador, "criterio": criterio,
                      "estado": "INFO", "observado": observado})

    documentos = {}
    for ruta, marcador in (("/docs", "SwaggerUIBundle"), ("/redoc", "<redoc"),
                           ("/docs/oauth2-redirect", "swaggerUIRedirectOauth2")):
        respuesta = cliente.get(ruta)
        documentos[ruta] = respuesta.text
        comprobar(f"SW-DOC-{len(documentos):02d}", f"{ruta} entrega su HTML",
                  respuesta.status_code == 200 and marcador in respuesta.text,
                  "HTTP 200 y marcador HTML esperado",
                  {"status": respuesta.status_code, "marcador": marcador in respuesta.text})

    respuesta = cliente.get("/openapi.json")
    esquema = respuesta.json() if respuesta.status_code == 200 else {}
    comprobar("SW-API-01", "OpenAPI disponible", respuesta.status_code == 200
              and str(esquema.get("openapi", "")).startswith("3."),
              "HTTP 200 y OpenAPI 3", {"status": respuesta.status_code, "version": esquema.get("openapi")})
    paths = esquema.get("paths", {})
    schemas = esquema.get("components", {}).get("schemas", {})

    def resolver(s):
        return schemas.get(s["$ref"].rsplit("/", 1)[-1], {}) if "$ref" in s else s

    def operacion(ruta, metodo):
        return paths.get(ruta, {}).get(metodo, {})

    def cuerpo(ruta, metodo, media="multipart/form-data"):
        s = operacion(ruta, metodo).get("requestBody", {}).get("content", {}).get(media, {}).get("schema", {})
        return resolver(s)

    def enum(s):
        s = resolver(s)
        valores = set(s.get("enum", []))
        for branch in s.get("anyOf", []) + s.get("oneOf", []):
            valores.update(enum(branch))
        return valores

    operaciones = [(ruta, metodo, op) for ruta, metodos in paths.items()
                   if ruta.startswith(("/api/", "/auth/"))
                   for metodo, op in metodos.items() if isinstance(op, dict)]
    informar("SW-INFO-01", "Alcance del esquema aislado", {
        "operaciones_api_auth": len(operaciones), "info": esquema.get("info"),
        "conexiones": "Router sustituido; no se auditan sus endpoints",
        "assets_swagger": re.findall(r'(?:src|href)="(https:[^"]+)"', documentos.get("/docs", "")),
        "navegador": "No se verifica renderizado ni descarga de assets externos",
    })
    principales = [("/api/publicaciones", "post", "201"),
                   ("/api/publicaciones", "get", "200"),
                   ("/api/publicaciones/buscar", "get", "200")]
    for i, (ruta, metodo, status) in enumerate(principales, 1):
        op = operacion(ruta, metodo)
        contenido = op.get("responses", {}).get(status, {}).get("content", {})
        correcto = bool(op) and "Publicaciones" in op.get("tags", []) and any(
            v.get("schema") for v in contenido.values())
        comprobar(f"SW-CORE-{i:02d}", f"Contrato de {metodo.upper()} {ruta}", correcto,
                  f"Operación etiquetada y respuesta {status} con esquema",
                  {"tags": op.get("tags"), "respuesta": op.get("responses", {}).get(status)})
    body = cuerpo("/api/publicaciones", "post")
    props = body.get("properties", {})
    obligatorios = {"titulo", "categoria", "ubicacion", "precio", "tipo",
                    "cupos_totales", "tipo_vivienda", "descripcion"}
    comprobar("SW-FORM-01", "Campos obligatorios de creación", set(body.get("required", [])) == obligatorios,
              sorted(obligatorios), body.get("required", []))
    esperado_enum = {"categoria": {"busco", "ofrezco"},
                     "tipo": {"Arrendador", "Compartida"},
                     "tipo_vivienda": {"casa", "departamento", "habitacion"}}
    comprobar("SW-FORM-02", "Enums principales de creación", all(enum(props.get(k, {})) == v for k, v in esperado_enum.items()),
              {k: sorted(v) for k, v in esperado_enum.items()},
              {k: sorted(enum(props.get(k, {}))) for k in esperado_enum})
    limites = {k: props.get(k, {}).get("maxLength") for k in ("titulo", "ubicacion", "descripcion")}
    comprobar("SW-FORM-03", "Límites de texto y cupos", limites == {"titulo": 200, "ubicacion": 250, "descripcion": 5000}
              and props.get("cupos_totales", {}).get("minimum") == 1
              and props.get("cupos_totales", {}).get("maximum") == 2147483647,
              "Título 200, ubicación 250, descripción 5000 y cupos 1..2147483647",
              {"textos": limites, "cupos": props.get("cupos_totales")})
    comprobar("SW-FORM-04", "Enum si/no de mascotas documentado", enum(props.get("mascota", {})) == {"si", "no"},
              ["si", "no"], props.get("mascota"))
    parametros = {v["name"]: v for v in operacion("/api/publicaciones/buscar", "get").get("parameters", [])}
    esperados = {"consulta", "personas", "tipo", "mascotas", "precio_min", "precio_max", "categoria", "limite", "offset"}
    comprobar("SW-FILTER-01", "Nueve filtros de búsqueda documentados", set(parametros) == esperados,
              sorted(esperados), sorted(parametros))
    enums_filtros = {"personas": {"1", "2", "3"}, "tipo": {"casa", "departamento", "habitacion"},
                     "mascotas": {"si", "no"}, "categoria": {"busco", "ofrezco"}}
    comprobar("SW-FILTER-02", "Valores de los filtros", all(enum(parametros.get(k, {}).get("schema", {})) == v for k, v in enums_filtros.items()),
              {k: sorted(v) for k, v in enums_filtros.items()},
              {k: sorted(enum(parametros.get(k, {}).get("schema", {}))) for k in enums_filtros})
    ids = [op.get("operationId") for _, _, op in operaciones]
    comprobar("SW-API-02", "Identificadores de operación únicos", all(ids) and len(ids) == len(set(ids)),
              "operationId presente y único", ids)
    protegidas = [(r, m, o) for r, m, o in operaciones if any(p.get("in") == "cookie" for p in o.get("parameters", []))]
    security = esquema.get("components", {}).get("securitySchemes", {})
    comprobar("SW-SEC-01", "Identidad representada como seguridad de la API",
              bool(security) and all(o.get("security") or esquema.get("security") for _, _, o in protegidas),
              "Esquema de seguridad y requisitos por operación protegida; verificar sesión en servidor",
              {"securitySchemes": security, "operaciones_con_cookie": [f"{m.upper()} {r}" for r, m, _ in protegidas],
               "nota": "Declarar seguridad en OpenAPI no sustituye autenticar al usuario"})
    vacias = [f"{m.upper()} {r}" for r, m, o in operaciones if not any(
        c.get("schema") for status, response in o.get("responses", {}).items() if status.startswith("2")
        for c in response.get("content", {}).values())]
    comprobar("SW-RESPONSE-01", "Éxitos con estructura documentada", not vacias,
              "Todas las respuestas de éxito del alcance tienen un esquema útil", vacias)
    errores = {
        ("/api/publicaciones", "post"): {"401", "413", "422", "500"},
        ("/api/publicaciones", "get"): {"500"},
        ("/api/publicaciones/buscar", "get"): {"422", "500"},
        ("/api/publicaciones/{id_pub}", "get"): {"404", "500"},
        ("/api/publicaciones/{id_pub}", "put"): {"401", "404", "413", "422", "500"},
        ("/api/publicaciones/{id_pub}", "delete"): {"401", "404", "500"},
        ("/api/publicaciones/{id_pub}/cupos", "get"): {"404", "500"},
        ("/api/publicaciones/{id_pub}/cerrar", "patch"): {"401", "404", "500"},
        ("/auth/registro", "post"): {"400", "409", "422", "500"},
        ("/auth/login", "post"): {"401", "422", "500"},
    }
    faltantes = {f"{m.upper()} {r}": sorted(codigos - set(operacion(r, m).get("responses", {})))
                 for (r, m), codigos in errores.items()}
    faltantes = {k: v for k, v in faltantes.items() if v}
    comprobar("SW-RESPONSE-02", "Estados de error reales documentados", not faltantes,
              "401/404/413/500 y reglas de auth según la operación", faltantes)

    datos = dict(titulo="Aviso QA", categoria="ofrezco", ubicacion="Temuco", precio="150000", tipo="Compartida",
                 cupos_totales="1", tipo_vivienda="casa", descripcion="Solo prueba", mascota="no")
    with patch.object(api, "conectar", return_value=ConexionSimulada((42,))):
        response_form = cliente.post("/api/publicaciones", data=datos)
    tipos = operacion("/api/publicaciones", "post").get("requestBody", {}).get("content", {})
    comprobar("SW-FORM-05", "URL encoded aceptado también documentado",
              response_form.status_code == 201 and "application/x-www-form-urlencoded" in tipos,
              "Si el formulario sin foto responde 201, documentar también su tipo de contenido",
              {"status_real": response_form.status_code, "content_type_enviado": response_form.request.headers.get("content-type"),
               "content_types_documentados": list(tipos)})
    probes = []

    def probar(identificador, criterio, response, esperado):
        body = response.json() if "application/json" in response.headers.get("content-type", "") else response.text
        probes.append({"id": identificador, "status": response.status_code, "body": body})
        comprobar(identificador, criterio, response.status_code == esperado, esperado,
                  {"status": response.status_code, "body": body})

    probar("SW-RUNTIME-01", "Filtro inválido rechazado", cliente.get("/api/publicaciones/buscar?tipo=oficina"), 422)
    probar("SW-RUNTIME-02", "Rango inválido rechazado", cliente.get("/api/publicaciones/buscar?precio_min=200&precio_max=100"), 422)
    probar("SW-RUNTIME-03", "Mascota inválida rechazada", cliente.post("/api/publicaciones", data=datos | {"mascota": "talvez"}), 422)
    cliente.cookies.set("roomies_id", "abc")
    probar("SW-RUNTIME-04", "Cookie malformada rechazada", cliente.post("/api/publicaciones", data=datos), 401)
    cliente.cookies.clear()
    with patch.object(api, "conectar", return_value=ConexionSimulada()):
        probar("SW-RUNTIME-05", "Publicación inexistente", cliente.get("/api/publicaciones/123"), 404)
    with patch.object(api, "conectar", side_effect=RuntimeError("detalle privado simulado")):
        probar("SW-RUNTIME-06", "Error de base genérico", cliente.get("/api/publicaciones"), 500)

    def tipos_schema(s):
        s = resolver(s)
        tipos = {s["type"]} if isinstance(s.get("type"), str) else set(s.get("type", []))
        for branch in s.get("anyOf", []) + s.get("oneOf", []):
            tipos.update(tipos_schema(branch))
        return tipos

    def tipos_detail(s):
        s = resolver(s)
        tipos = tipos_schema(s.get("properties", {}).get("detail", {}))
        for branch in s.get("anyOf", []) + s.get("oneOf", []):
            tipos.update(tipos_detail(branch))
        return tipos

    schema422 = operacion("/api/publicaciones/buscar", "get").get("responses", {}).get("422", {}).get("content", {}).get("application/json", {}).get("schema", {})
    tipos_documentados = tipos_detail(schema422)
    tipos_reales = {"array" if isinstance(p["body"].get("detail"), list) else "string"
                    for p in probes[:3] if isinstance(p["body"], dict) and p["status"] == 422}
    comprobar("SW-RESPONSE-03", "Forma de detail en errores 422 compatible", tipos_reales <= tipos_documentados,
              sorted(tipos_reales), {"tipos_documentados": sorted(tipos_documentados), "tipos_reales": sorted(tipos_reales)})
    informar("SW-INFO-02", "Reglas adicionales no representadas por el formulario",
             {"mascotas": "Especies, JSON y condición otro requieren descripción/ejemplos",
              "imagen": "Describir formatos y límite de 5 MB",
              "tags_ausentes": [f"{m.upper()} {r}" for r, m, o in operaciones if not o.get("tags")]})
    return esquema, casos


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output-dir", type=Path, default=ROOT / "output/qa")
    args = parser.parse_args()
    with patch("dotenv.load_dotenv", return_value=False), patch("psycopg.connect", side_effect=AssertionError("Conexión real bloqueada")) as conectar:
        api = cargar_aplicacion()
        cliente = TestClient(api.app, raise_server_exceptions=False)
        try:
            esquema, casos = auditar(api, cliente)
        finally:
            cliente.close()
        llamadas = conectar.call_count
    casos.append({"id": "SW-ISOLATION-01", "criterio": "No se intentó conectar a PostgreSQL",
                  "estado": "PASS" if llamadas == 0 else "FAIL", "esperado": 0, "observado": llamadas})
    conteo = Counter(c["estado"] for c in casos)
    resultado = {
        "alcance": "Publicaciones y auth reales; router de conexiones sustituido; sin lifespan ni PostgreSQL",
        "metodo": "ASGI TestClient en proceso; no es un navegador ni una prueba TCP",
        "archivos_producto_modificados": False,
        "totales": {"total": len(casos), "PASS": conteo["PASS"], "FAIL": conteo["FAIL"], "INFO": conteo["INFO"]},
        "criterio_salida": "0 sin FAIL; 1 si hay incumplimientos documentales o funcionales",
        "casos": casos,
    }
    args.output_dir.mkdir(parents=True, exist_ok=True)
    (args.output_dir / "swagger.json").write_text(json.dumps(resultado, ensure_ascii=False, indent=2), encoding="utf-8")
    (args.output_dir / "openapi_auditado.json").write_text(json.dumps(esquema, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps(resultado["totales"], ensure_ascii=False))
    print(f"Evidencia: {args.output_dir / 'swagger.json'}")
    return 1 if conteo["FAIL"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
