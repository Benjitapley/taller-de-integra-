"""Regresiones SQL sin mocks en el servidor real 127.0.0.1:5432.

Usa una base propia con nombre aleatorio; nunca trunca roomies_local.
"""
import json
import os
from pathlib import Path
import sys
from urllib.parse import quote
from uuid import uuid4

import psycopg
from psycopg import sql


def main():
    private = Path(os.environ["LOCALAPPDATA"]) / "Roomies/local-e03"
    admin = json.loads((private / "postgres-admin.json").read_text(encoding="utf-8"))
    if admin.get("host") != "127.0.0.1" or admin.get("port") != 5432:
        raise SystemExit("Solo se permite el servidor local en 5432.")
    runtime = json.loads((private / "runtime-local.json").read_text(encoding="utf-8"))
    name = "roomies_e03_test_" + uuid4().hex
    admin["dbname"] = "postgres"
    with psycopg.connect(**admin, autocommit=True, connect_timeout=5) as connection:
        connection.execute(sql.SQL("CREATE DATABASE {}").format(sql.Identifier(name)))
    try:
        role = "sql_convivencia_mensajeria"
        root = Path(__file__).resolve().parents[2]
        service = root / "backend/services/convivencia-mensajeria-service"
        os.environ.update({
            "ROOMIES_LOCAL_MODE": "1", "ROOMIES_RUNTIME_MODE": "local-postgres",
            "ROOMIES_LOCAL_DATABASE": name, "PYTEST_DISABLE_PLUGIN_AUTOLOAD": "1",
            "CONVIVENCIA_DATABASE_URL": f"postgresql://{role}:{quote(runtime[role], safe='')}@127.0.0.1:5432/{name}",
            "CONVIVENCIA_TEST_ADMIN_DSN": f"postgresql://{quote(admin['user'], safe='')}:{quote(admin['password'], safe='')}@127.0.0.1:5432/{name}",
        })
        sys.path[:0] = [str(service), str(root)]
        import pytest
        print("Servidor real 127.0.0.1:5432; base de regresión propia; sin mocks de SQL ni HTTP.")
        return pytest.main([str(service / "tests/test_mensajeria_sql.py"), "--rootdir", str(service),
                            "--confcutdir", str(service), "--import-mode=importlib", "-q", "-s", "-p", "no:cacheprovider"])
    finally:
        # Solo el nombre generado por este proceso; jamás la base de integración.
        assert name.startswith("roomies_e03_test_") and len(name) == 49
        with psycopg.connect(**admin, autocommit=True, connect_timeout=5) as connection:
            connection.execute(sql.SQL("DROP DATABASE {} WITH (FORCE)").format(sql.Identifier(name)))
        print("PASS eliminación de la base de regresión propia; roomies_local conservada.")


if __name__ == "__main__":
    raise SystemExit(main())
