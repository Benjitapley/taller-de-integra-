import os
if os.getenv("HAYCUPO_ISOLATED_TESTS") != "1":
    raise RuntimeError("Usa backend/tests/run_isolated.py: pytest directo no garantiza aislamiento.")

from copy import deepcopy
from datetime import datetime, timezone
import pytest
from fastapi.testclient import TestClient
from backend.auth_service import main as auth, database
from backend.auth_service.config import get_settings
from backend.main import main as web


class Cursor:
    def __init__(self, rows=(), rowcount=1):
        self.rows, self.rowcount = list(rows), rowcount

    def fetchone(self):
        return self.rows[0] if self.rows else None

    def fetchall(self):
        return self.rows


class MemoryDB:
    """Doble de SQL con commit/rollback; no pretende probar locks PostgreSQL."""
    def __init__(self):
        self.users, self.codes, self.sessions = {}, {}, {}
        self.calls, self.outcomes = [], []
        self.publications, self.images_deleted = {}, False

    def connect(self):
        return Connection(self)


class Connection:
    def __init__(self, db):
        self.db = db

    def __enter__(self):
        self.snapshot = deepcopy((self.db.users, self.db.codes, self.db.sessions))
        return self

    def __exit__(self, kind, value, traceback):
        if kind:
            self.db.users, self.db.codes, self.db.sessions = self.snapshot
        self.db.outcomes.append("rollback" if kind else "commit")

    def execute(self, sql, params=()):
        q = " ".join(sql.lower().split())
        d = self.db
        d.calls.append((q, params))
        if "pg_advisory_xact_lock" in q:
            return Cursor()
        if "select id_usuario, nombre, correo, verificado" in q:
            return Cursor([(i, u["nombre"], u["correo"], u["verificado"]) for i, u in d.users.items() if u["correo"].strip().lower() == params[0]])
        if q.startswith("insert into haycupo.usuario"):
            i = max(d.users, default=0) + 1
            d.users[i] = dict(nombre=params[0], correo=params[1], contrasena=params[2], fecha_nacimiento=params[3], verificado=False)
            return Cursor([(i,)])
        if q.startswith("select creado_en"):
            return Cursor([(c["creado_en"],) for c in sorted(d.codes.values(), key=lambda c: c["creado_en"], reverse=True) if c["id_usuario"] == params[0] and c["creado_en"] >= params[1]])
        if q.startswith("insert into haycupo.codigo_verificacion"):
            i = max(d.codes, default=0) + 1
            d.codes[i] = dict(id_usuario=params[0], codigo_hash=params[1], expira_en=params[2], creado_en=params[3], intentos=0, usado=False, enviado_en=None)
            return Cursor([(i,)])
        if q.startswith("update haycupo.codigo_verificacion set usado = true where id_usuario"):
            for c in d.codes.values():
                if c["id_usuario"] == params[0]:
                    c["usado"] = True
            return Cursor()
        if q.startswith("update haycupo.codigo_verificacion set enviado_en"):
            c = d.codes.get(params[1])
            if not c or c["usado"]:
                return Cursor([])
            c["enviado_en"] = params[0]
            return Cursor([(params[1],)])
        if q.startswith("update haycupo.codigo_verificacion set usado = true where id ="):
            d.codes[params[0]]["usado"] = True
            return Cursor()
        if q.startswith("select id, codigo_hash"):
            codes = [(i, c) for i, c in d.codes.items() if c["id_usuario"] == params[0] and not c["usado"] and c["enviado_en"] is not None]
            codes.sort(key=lambda pair: (pair[1]["creado_en"], pair[0]), reverse=True)
            return Cursor([(i, c["codigo_hash"], c["expira_en"], c["intentos"]) for i, c in codes[:1]])
        if q.startswith("update haycupo.codigo_verificacion set intentos"):
            d.codes[params[2]].update(intentos=params[0], usado=params[1])
            return Cursor()
        if q.startswith("update haycupo.usuario set verificado"):
            d.users[params[0]]["verificado"] = True
            return Cursor()
        if q.startswith("select contrasena"):
            return Cursor([(d.users[params[0]]["contrasena"],)])
        if q.startswith("insert into haycupo.sesion_jwt"):
            d.sessions[params[0]] = dict(id_usuario=params[1], expira_en=params[2], revocado=False)
            return Cursor()
        if "join haycupo.sesion_jwt" in q:
            s = d.sessions.get(params[1])
            u = d.users.get(params[0])
            valid = s and u and s["id_usuario"] == params[0] and u["verificado"] and not s["revocado"] and s["expira_en"] > datetime.now(timezone.utc)
            return Cursor([(params[0],)] if valid else [])
        if q.startswith("update haycupo.sesion_jwt"):
            d.sessions[params[0]]["revocado"] = True
            return Cursor()
        if q.startswith("select nombre, edad"):
            u = d.users.get(params[0])
            return Cursor([(u["nombre"], u.get("edad", 25), u.get("ocupacion", "Estudiante"), u.get("ciudad", "Ciudad"), u.get("breve_descripcion", "Descripción"), u.get("sobre_mi", "Sobre mí"), u.get("foto_perfil"), u["verificado"])] if u else [])
        if q.startswith("select count(*)"):
            return Cursor([(0,)])
        if q.startswith("select id_publicacion from haycupo.publicacion"):
            return Cursor([(params[0],)] if d.publications.get(params[0]) == params[1] else [])
        if q.startswith("select titulo, categoria, tipo_vivienda, ubicacion, precio"):
            return Cursor([("Título", "ofrezco", "casa", "Ciudad", 100, 1, "no", "Descripción")]
                          if d.publications.get(params[0]) == params[1] else [])
        if q.startswith("insert into haycupo.publicacion"):
            i = max(d.publications, default=0) + 1
            d.publications[i] = params[0]
            return Cursor([(i,)])
        if q.startswith("update haycupo.usuario set edad"):
            if params[-1] in d.users:
                fields = ["edad", "ocupacion", "ciudad", "breve_descripcion", "sobre_mi"]
                if "foto_perfil=%s" in q:
                    fields.append("foto_perfil")
                d.users[params[-1]].update(zip(fields, params[:-1]))
            return Cursor(rowcount=1 if params[-1] in d.users else 0)
        if q.startswith("delete from haycupo.imagen_publicacion"):
            d.images_deleted = True
            return Cursor()
        if q.startswith("delete from haycupo.publicacion"):
            d.publications.pop(params[0], None)
            return Cursor()
        if q.startswith("update haycupo.publicacion"):
            return Cursor(rowcount=1 if d.publications.get(params[-2]) == params[-1] else 0)
        if "from haycupo.publicacion" in q:
            return Cursor([])
        raise AssertionError("SQL no cubierto por el doble de prueba: " + q)


@pytest.fixture(autouse=True)
def clear_config():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


@pytest.fixture
def db(monkeypatch):
    db = MemoryDB()
    monkeypatch.setattr(database, "conectar", db.connect)
    monkeypatch.setattr(web, "conectar", db.connect)
    return db


@pytest.fixture
def mail(monkeypatch):
    messages = []
    def deliver(correo, nombre, code):
        messages.append((correo, nombre, code))
        return True
    monkeypatch.setattr(auth, "enviar_codigo_verificacion", deliver)
    return messages


@pytest.fixture
def client(db):
    return TestClient(web.app)  # Sin lifespan: no inicializa carpetas ni BD.


@pytest.fixture
def payload():
    return {"nombre": "Validación aislada", "correo": "validacion@example.com", "contrasena": "clave-solo-test", "fecha_nacimiento": "2000-01-01"}
