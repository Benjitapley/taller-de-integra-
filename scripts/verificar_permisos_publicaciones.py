"""Prueba permisos con datos simulados; falla si la política segura no se cumple.

No inicia el ciclo de vida de FastAPI, lee .env ni accede a PostgreSQL. Las
identidades declaradas verifican el filtro SQL, no una sesión autenticada real.
"""
import argparse
import importlib.util
import json
import sys
from decimal import Decimal
from pathlib import Path
from unittest.mock import patch

from fastapi.testclient import TestClient

ROOT = Path(__file__).resolve().parents[1]
FORM = dict(titulo="Aviso QA", categoria="ofrezco", ubicacion="Ciudad QA", precio="150000",
            tipo="Compartida", cupos_totales="2", tipo_vivienda="casa", descripcion="Datos de prueba",
            mascota="no", tipos_mascotas_aceptadas="[]")


class Cursor:
    def __init__(self, data):
        self.data = data

    def fetchone(self):
        return self.data

    def fetchall(self):
        return self.data


class Database:
    """Aplica la relación de dueño con los parámetros que realmente envía la API."""
    def __init__(self):
        self.pubs = {42: {"owner": 1, "state": "Disponible"},
                     43: {"owner": 2, "state": "Disponible"},
                     44: {"owner": 37, "state": "Disponible"}}
        self.queries, self.writes = [], []
        self.locked = set()

    def __enter__(self):
        return self

    def __exit__(self, *args):
        return False

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
        elif normalized.startswith("select id_usuario, nombre"):
            assert p == ("qa.usuario2@example.com", "claveQA123")
            result = (2, "Usuario QA 2")
        else:
            raise AssertionError("Consulta no prevista en el simulador: " + normalized)
        return Cursor(result)


def load_api():
    """Reutiliza el cargador de pruebas que sustituye routers de servicios externos."""
    previous_path = list(sys.path)
    sys.path[:0] = [str(ROOT), str(ROOT / "tests")]
    try:
        from test_publicaciones import cargar_api_sin_servicios_externos
        return cargar_api_sin_servicios_externos()
    finally:
        sys.path[:] = previous_path


def run_case(rows, api, name, cookie, method, url, expected, data=None):
    db = Database()
    client = TestClient(api.app, raise_server_exceptions=False)
    try:
        if cookie is not None:
            client.cookies.set("roomies_id", cookie)
        with patch.object(api, "conectar", return_value=db) as conectar:
            response = client.request(method, url, data=data)
        try:
            body = response.json()
        except ValueError:
            body = response.text
        if response.status_code == 200 and method == "GET" and url == "/api/mis-publicaciones":
            declared_owner = int(cookie) if cookie is not None else 1
            expected_ids = [k for k, v in db.pubs.items() if v["owner"] == declared_owner]
            assert [item["id"] for item in body] == expected_ids, "Se mezclaron distintos IDs declarados"
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
                     "conexion_fake_llamada": conectar.called, "cuerpo": body})
    finally:
        client.close()


def run_logout_case(rows, api):
    spec = importlib.util.spec_from_file_location("qa_auth_permissions", ROOT / "auth_service/main.py")
    auth = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(auth)
    api.app.include_router(auth.auth_router)
    client = TestClient(api.app, raise_server_exceptions=False)
    db = Database()
    try:
        with patch.object(api, "conectar", return_value=db), patch.object(auth, "conectar", return_value=db):
            login = client.post("/auth/login", json={"correo": "qa.usuario2@example.com", "contrasena": "claveQA123"})
            before = client.get("/api/mis-publicaciones")
            logout = client.post("/auth/logout")
            cookie_deleted = client.cookies.get("roomies_id") is None
            after = client.get("/api/mis-publicaciones")
        assert login.status_code == 200 and before.status_code == 200 and logout.status_code == 200
        assert [item["id"] for item in before.json()] == [43]
        assert cookie_deleted
        after_ids = [item["id"] for item in after.json()] if after.status_code == 200 else []
        rows.append({"caso": "login_usuario2_logout_y_acceso_privado", "cookie_declarada": None,
                     "metodo": "GET", "ruta": "/api/mis-publicaciones", "esperado_seguro": 401,
                     "obtenido": after.status_code, "resultado": "PASS" if after.status_code == 401 else "FAIL",
                     "escrituras_simuladas": db.writes, "consultas_simuladas": len(db.queries),
                     "pasos": [{"login": login.status_code},
                               {"propias_antes_logout": before.status_code, "ids": [43]},
                               {"logout": logout.status_code, "cookie_eliminada": cookie_deleted},
                               {"propias_despues_logout": after.status_code, "ids": after_ids}]})
    finally:
        client.close()


def verify():
    rows = []
    with patch("dotenv.load_dotenv", return_value=False), \
            patch("psycopg.connect", side_effect=AssertionError("Conexión real bloqueada")) as real_connect, \
            patch.object(Path, "write_bytes", side_effect=AssertionError("Archivo real bloqueado")), \
            patch.object(Path, "unlink", side_effect=AssertionError("Borrado real bloqueado")):
        api = load_api()
        for actor, cookie in (("propietario_declarado_1", "1"), ("otro_usuario_declarado_2", "2"),
                              ("anonimo", None), ("cookie_invalida", "abc")):
            for url in ("/api/publicaciones", "/api/publicaciones/buscar", "/api/publicaciones/42", "/api/publicaciones/42/cupos"):
                run_case(rows, api, actor + "_publico_" + url, cookie, "GET", url, 200)
            for method, url, data in (("GET", "/api/mis-publicaciones", None),
                                      ("POST", "/api/publicaciones", FORM),
                                      ("PUT", "/api/publicaciones/42", FORM),
                                      ("PATCH", "/api/publicaciones/42/cerrar", None),
                                      ("DELETE", "/api/publicaciones/42", None),
                                      ("GET", "/api/perfil", None),
                                      ("PUT", "/api/perfil", {"ciudad": "Ciudad actualizada QA"})):
                if actor in ("anonimo", "cookie_invalida"):
                    expected = 401
                elif actor == "otro_usuario_declarado_2" and "/42" in url:
                    expected = 404
                else:
                    expected = 201 if method == "POST" else 200
                run_case(rows, api, actor + "_" + method + "_" + url, cookie, method, url, expected, data)
        for method, url, data in (("GET", "/api/mis-publicaciones", None),
                                  ("POST", "/api/publicaciones", FORM),
                                  ("PUT", "/api/publicaciones/44", FORM),
                                  ("PATCH", "/api/publicaciones/44/cerrar", None),
                                  ("DELETE", "/api/publicaciones/44", None),
                                  ("GET", "/api/perfil", None),
                                  ("PUT", "/api/perfil", {"ciudad": "Ciudad actualizada QA"})):
            run_case(rows, api, "cookie_forjada_37_" + method + "_" + url, "37", method, url, 401, data)
        for method, url, data in (("PUT", "/api/publicaciones/999", FORM),
                                  ("PATCH", "/api/publicaciones/999/cerrar", None),
                                  ("DELETE", "/api/publicaciones/999", None)):
            run_case(rows, api, "propietario_recurso_inexistente_" + method, "1", method, url, 404, data)
        run_logout_case(rows, api)
        assert real_connect.call_count == 0
    return {"descripcion": "Identidades declaradas y dueño SQL; política segura requiere rechazar anónimo y cookie forjada",
            "totales": {"casos": len(rows), "pass": sum(r["resultado"] == "PASS" for r in rows),
                        "fail": sum(r["resultado"] == "FAIL" for r in rows)},
            "red_real": False, "base_real": False, "lectura_env": False, "casos": rows}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--output", type=Path, default=ROOT / "output/qa/permisos.json")
    args = parser.parse_args()
    result = verify()
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print(json.dumps({"totales": result["totales"], "evidencia": str(args.output)}, ensure_ascii=False))
    return 1 if result["totales"]["fail"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
