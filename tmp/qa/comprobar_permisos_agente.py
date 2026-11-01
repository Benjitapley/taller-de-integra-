"""Sondeo de permisos aislado. No activa lifespan ni conecta bases reales."""
import json
import sys
from decimal import Decimal
from pathlib import Path
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT))
sys.path.insert(0, str(ROOT / "tests"))
from fastapi.testclient import TestClient
from test_publicaciones import cargar_api_sin_servicios_externos

FORM = dict(titulo="Aviso QA", categoria="ofrezco", ubicacion="Ciudad QA", precio="150000",
            tipo="Compartida", cupos_totales="2", tipo_vivienda="casa", descripcion="Datos de prueba",
            mascota="no", tipos_mascotas_aceptadas="[]")

class Cursor:
    def __init__(self, data): self.data = data
    def fetchone(self): return self.data
    def fetchall(self): return self.data

class Database:
    def __init__(self):
        self.pubs = {42: {"owner": 1, "state": "Disponible"},
                     43: {"owner": 2, "state": "Disponible"},
                     44: {"owner": 37, "state": "Disponible"}}
        self.queries, self.writes = [], []
        self.locked = set()

    def __enter__(self): return self
    def __exit__(self, *args): return False

    def owned(self, pubid, userid):
        return pubid in self.pubs and self.pubs[pubid]["owner"] == userid

    def execute(self, sql, parameters=None):
        normalized = " ".join(sql.lower().split())
        self.queries.append((normalized, parameters))
        p = parameters or ()
        result = None
        if normalized.startswith("insert into haycupo.publicacion"):
            result = (100,)
            self.writes.append({"accion": "crear", "autor": p[0]})
        elif normalized.startswith("select mascota, tipos_mascotas_aceptadas"):
            assert "and id_usuario = %s" in normalized
            result = ("no", [], None) if self.owned(*p) else None
        elif normalized.startswith("update haycupo.publicacion set titulo"):
            assert "where id_publicacion=%s and id_usuario=%s" in normalized
            assert self.owned(p[-2], p[-1])
            self.writes.append({"accion": "editar", "id": p[-2], "autor": p[-1]})
        elif normalized.startswith("update haycupo.publicacion set estado"):
            assert "and id_usuario = %s" in normalized
            if self.owned(*p):
                self.pubs[p[0]]["state"] = "Cerrada"
                result = ("Cerrada", 2)
                self.writes.append({"accion": "cerrar", "id": p[0], "autor": p[1]})
        elif normalized.startswith("select id_publicacion from haycupo.publicacion"):
            assert "and id_usuario = %s" in normalized
            if self.owned(*p):
                result = (p[0],)
                self.locked.add(p[0])
        elif normalized.startswith("delete from haycupo.imagen_publicacion"):
            assert p[0] in self.locked, "Se intentaron borrar imágenes sin comprobar dueño"
            self.writes.append({"accion": "borrar_imagenes", "id": p[0]})
        elif normalized.startswith("delete from haycupo.publicacion"):
            assert "and id_usuario = %s" in normalized and self.owned(*p)
            self.pubs.pop(p[0])
            self.writes.append({"accion": "eliminar", "id": p[0], "autor": p[1]})
        elif normalized.startswith("select p.id_publicacion"):
            if "where p.id_usuario = %s" in normalized:
                result = [(k, f"Aviso {k}", Decimal("150000"), v["state"], "casa", "Ciudad QA", 2, None)
                          for k, v in self.pubs.items() if v["owner"] == p[0]]
            else:
                result = [(k, f"Aviso {k}", Decimal("150000"), "Ciudad QA", 2, "casa", None,
                           "ofrezco", "Datos QA", "no", None, [], None, v["state"])
                          for k, v in self.pubs.items() if v["state"] != "Cerrada"]
        elif normalized.startswith("select p.titulo"):
            if p[0] in self.pubs:
                result = (f"Aviso {p[0]}", "ofrezco", "casa", "Ciudad QA", Decimal("150000"),
                          2, "no", "Datos QA", [], None, self.pubs[p[0]]["state"], "Compartida", False, None)
        elif normalized.startswith("select estado, cupos_totales"):
            result = (self.pubs[p[0]]["state"], 2) if p[0] in self.pubs else None
        elif normalized.startswith("select nombre, edad"):
            result = (f"Usuario QA {p[0]}", 25, "Ocupación QA", "Ciudad QA", "Texto QA", "Texto QA", None)
        elif normalized.startswith("select count(*)"):
            result = (sum(v["owner"] == p[0] for v in self.pubs.values()),)
        elif normalized.startswith("update haycupo.usuario"):
            self.writes.append({"accion": "editar_perfil", "autor": p[-1]})
        else:
            raise AssertionError("Consulta no prevista en el simulador: " + normalized)
        return Cursor(result)

rows = []
def run_case(api, name, cookie, method, url, expected, data=None):
    db = Database()
    client = TestClient(api.app, raise_server_exceptions=False)
    try:
        if cookie is not None:
            client.cookies.set("roomies_id", cookie)
        with patch.object(api, "conectar", return_value=db) as conectar, \
                patch.object(Path, "write_bytes", side_effect=AssertionError("No se permiten archivos reales")):
            response = client.request(method, url, data=data)
        try: body = response.json()
        except ValueError: body = response.text
        if response.status_code == 200 and method == "GET" and url == "/api/mis-publicaciones":
            declared_owner = int(cookie) if cookie is not None else 1
            expected_ids = [k for k, v in db.pubs.items() if v["owner"] == declared_owner]
            assert [item["id"] for item in body] == expected_ids, "Se mezclaron datos de distintos IDs declarados"
        if response.status_code == 200 and method == "GET" and url == "/api/perfil":
            declared_owner = int(cookie) if cookie is not None else 1
            assert body["nombre"] == f"Usuario QA {declared_owner}"
        if response.status_code == 201 and method == "POST":
            declared_owner = int(cookie) if cookie is not None else 1
            assert db.writes == [{"accion": "crear", "autor": declared_owner}]
        if response.status_code in (401, 404):
            assert not db.writes, "Un rechazo de permisos dejó escrituras simuladas"
        rows.append({"caso": name, "cookie_declarada": cookie, "metodo": method, "ruta": url,
                     "esperado_seguro": expected, "obtenido": response.status_code,
                     "resultado": "PASS" if response.status_code == expected else "FAIL",
                     "escrituras_simuladas": db.writes, "consultas_simuladas": len(db.queries),
                     "conexion_fake_llamada": conectar.called,
                     "cuerpo": body})
    finally:
        client.close()

with patch("dotenv.load_dotenv", return_value=False), \
        patch("psycopg.connect", side_effect=AssertionError("Conexión real bloqueada")) as real_connect:
    api = cargar_api_sin_servicios_externos()
    for actor, cookie in (("propietario_declarado_1", "1"), ("otro_usuario_declarado_2", "2"),
                          ("anonimo", None), ("cookie_invalida", "abc")):
        invalid = actor == "cookie_invalida"
        anonymous = actor == "anonimo"
        for url in ("/api/publicaciones", "/api/publicaciones/buscar", "/api/publicaciones/42", "/api/publicaciones/42/cupos"):
            run_case(api, actor + "_publico_" + url, cookie, "GET", url, 200)
        for method, url, data in (("GET", "/api/mis-publicaciones", None),
                                  ("POST", "/api/publicaciones", FORM),
                                  ("PUT", "/api/publicaciones/42", FORM),
                                  ("PATCH", "/api/publicaciones/42/cerrar", None),
                                  ("DELETE", "/api/publicaciones/42", None),
                                  ("GET", "/api/perfil", None),
                                  ("PUT", "/api/perfil", {"ciudad": "Ciudad actualizada QA"})):
            if anonymous or invalid: expected = 401
            elif actor == "otro_usuario_declarado_2" and "/42" in url: expected = 404
            else: expected = 201 if method == "POST" else 200
            run_case(api, actor + "_" + method + "_" + url, cookie, method, url, expected, data)
    for method, url, data in (("GET", "/api/mis-publicaciones", None),
                              ("POST", "/api/publicaciones", FORM),
                              ("PUT", "/api/publicaciones/44", FORM),
                              ("PATCH", "/api/publicaciones/44/cerrar", None),
                              ("DELETE", "/api/publicaciones/44", None),
                              ("GET", "/api/perfil", None),
                              ("PUT", "/api/perfil", {"ciudad": "Ciudad actualizada QA"})):
        run_case(api, "cookie_forjada_37_" + method + "_" + url, "37", method, url, 401, data)
    for method, url, data in (("PUT", "/api/publicaciones/999", FORM),
                              ("PATCH", "/api/publicaciones/999/cerrar", None),
                              ("DELETE", "/api/publicaciones/999", None)):
        run_case(api, "propietario_recurso_inexistente_" + method, "1", method, url, 404, data)
    assert real_connect.call_count == 0

result = {"descripcion": "Matriz con identidad declarada y DB simulada que aplica dueño; expected seguro distingue anónimo/cookie forjada",
          "totales": {"casos": len(rows), "pass": sum(r["resultado"] == "PASS" for r in rows),
                      "fail": sum(r["resultado"] == "FAIL" for r in rows)},
          "red_real": False, "base_real": False, "lectura_env": False,
          "casos": rows}
target = ROOT / "tmp/qa/permisos_agente.json"
target.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
print(json.dumps(result["totales"]))
print("Conexiones reales bloqueadas y no llamadas")
for row in rows:
    if row["resultado"] == "FAIL":
        print(row["caso"], "expected", row["esperado_seguro"], "actual", row["obtenido"], row["escrituras_simuladas"])
