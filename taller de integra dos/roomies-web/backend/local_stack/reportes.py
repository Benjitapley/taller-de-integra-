"""Pruebas de SCRUM-95 únicamente dentro del clúster descartable del runner."""
import secrets
from pathlib import Path
from uuid import uuid4

import psycopg
from psycopg import sql


SERVICES = Path(__file__).resolve().parents[1] / "services"


def prepare_reports(owner, port):
    with psycopg.connect(owner, autocommit=True) as connection:
        urls = {}
        for service, role in (("convivencia", "sql_convivencia_mensajeria"), ("reportes", "sql_reportes")):
            password = secrets.token_hex(32)
            connection.execute(sql.SQL("CREATE ROLE {} LOGIN NOINHERIT PASSWORD {}").format(
                sql.Identifier(role), sql.Literal(password),
            ))
            connection.execute(sql.SQL("GRANT CONNECT ON DATABASE roomies_sprint2_disposable TO {}").format(sql.Identifier(role)))
            urls[service] = f"postgresql://{role}:{password}@127.0.0.1:{port}/roomies_sprint2_disposable"
        for path in (
            "reportes-service/migrations/001_reportes.up.sql",
            "match-conexion-service/migrations/001_relacion_aceptada.up.sql",
            "convivencia-mensajeria-service/migrations/001_convivencia_schema.up.sql",
            "convivencia-mensajeria-service/migrations/002_relacion_historica.up.sql",
        ):
            connection.execute((SERVICES / path).read_text(encoding="utf-8"), prepare=False)
        assert not connection.execute(
            "SELECT has_table_privilege('sql_reportes','match_conexion.relacion_aceptada','SELECT')"
        ).fetchone()[0]
        assert not connection.execute(
            "SELECT has_table_privilege('sql_match_conexion','reportes.reporte','SELECT')"
        ).fetchone()[0]
    print("PASS migraciones y aislamiento SQL de reportes", flush=True)
    return urls


def fixture_overlap(owner, publication, first, second):
    with psycopg.connect(owner) as connection:
        rental = connection.execute(
            """INSERT INTO convivencia_mensajeria.arriendo(id_publicacion,cupos_totales,version_capacidad)
                VALUES (%s,2,1) RETURNING id_arriendo""", (publication,),
        ).fetchone()[0]
        for application, person in enumerate((first, second), 1):
            operation = uuid4()
            connection.execute("""INSERT INTO convivencia_mensajeria.incorporacion
                (id_operacion,payload,estado,http_status,respuesta) VALUES (%s,'{}','Terminada',201,'{}')""",
                (operation,),
            )
            connection.execute("""INSERT INTO convivencia_mensajeria.pertenencia
                (id_arriendo,id_usuario,id_postulacion,id_operacion,creada_en)
                VALUES (%s,%s,%s,%s,clock_timestamp()-interval '1 day')""",
                (rental, person, application, operation),
            )
        connection.execute("""UPDATE convivencia_mensajeria.pertenencia SET estado='Inactiva'
            WHERE id_arriendo=%s AND id_usuario=%s""", (rental, first))


def exercise_reports(owner, request, ids, publication, connection):
    reports = "/api/reportes"
    mine = reports + "/mios"
    reason = {"categoria": "Conducta", "descripcion": "Descripción ficticia."}
    target = {"id_publicacion_reportada": publication}
    request("GET", mine, person=None, status=401)
    request("POST", reports, person=None, status=401, json={**reason, **target})
    request("POST", reports, status=422, json=reason)
    request("POST", reports, status=422, json={**reason, **target, "id_usuario_reportado": ids[1]})
    request("POST", reports, status=403, json={**reason, **target})
    request("POST", reports, status=404, json={**reason, "id_publicacion_reportada": 2147483647})
    request("POST", reports, status=403, json={**reason, "id_usuario_reportado": ids[2]})
    first = request("POST", reports, person=1, status=201, json={**reason, **target})
    assert first["estado"] == "Pendiente" and first["tipo"] == "Publicacion"
    assert request("GET", mine)["items"] == []

    request("DELETE", f"/conexiones/{connection}", status=204)
    user_report = request("POST", reports, status=201, json={**reason, "id_usuario_reportado": ids[1]})
    assert user_report["tipo"] == "Usuario"
    fixture_overlap(owner, publication, ids[0], ids[2])
    historical = request("POST", reports, status=201, json={**reason, "id_usuario_reportado": ids[2]})
    assert historical["id_reporte"] != user_report["id_reporte"]

    page = request("GET", mine + "?limite=1")
    assert page["items"] == [historical] and page["siguiente_cursor"]
    assert request("GET", mine, params={"cursor": page["siguiente_cursor"]})["items"] == [user_report]
    request("GET", mine, person=1, params={"cursor": page["siguiente_cursor"]}, status=422)
    assert request("GET", mine, person=1)["items"] == [first]
    request("GET", "/internal/conexiones/relacion", status=404, params={"a": ids[0], "b": ids[1]})
    print("PASS reportes por publicación, conexión eliminada y convivencia histórica; permisos y cursor", flush=True)
