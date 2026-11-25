"""Pruebas de SCRUM-95 y SCRUM-96 dentro del clúster descartable."""
import secrets
import time
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path
from threading import Barrier
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
            "reportes-service/migrations/002_revision.up.sql",
            "reportes-service/migrations/003_idempotencia.up.sql",
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
    return rental


def rental_snapshot(owner, rental):
    with psycopg.connect(owner) as connection:
        return connection.execute("""
            SELECT a.cupos_totales,a.version_capacidad,p.id_pertenencia,p.id_usuario,p.estado,p.terminada_en
            FROM convivencia_mensajeria.arriendo a
            LEFT JOIN convivencia_mensajeria.pertenencia p USING (id_arriendo)
            WHERE a.id_arriendo=%s ORDER BY p.id_pertenencia
            """, (rental,)).fetchall()


def simultaneous_requests(send, method, path, payloads, **kwargs):
    ready = Barrier(2, timeout=5)

    def submit(body):
        ready.wait()
        return send(method, path, json=body, **kwargs)

    with ThreadPoolExecutor(max_workers=2) as pool:
        return list(pool.map(submit, payloads))


def exercise_reports(owner, request, send, ids, publication, connection):
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
    payload = {**reason, **target}
    keyed = {"Idempotency-Key": str(uuid4())}
    preflight = send("OPTIONS", reports, person=None, headers={
        "Origin": "http://127.0.0.1:3000",
        "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization, idempotency-key",
    })
    assert preflight.status_code == 204 and "idempotency-key" in preflight.headers["Access-Control-Allow-Headers"].lower()
    request("POST", reports, person=1, status=422, json=payload, headers={"Idempotency-Key": "invalida"})
    initial, repeated = simultaneous_requests(send, "POST", reports, [payload, payload], person=1, headers=keyed)
    assert initial.status_code == repeated.status_code == 201, (initial.text, repeated.text)
    first = initial.json()
    assert repeated.json() == first
    assert first["estado"] == "Pendiente" and first["tipo"] == "Publicacion"
    replay = request("POST", reports, person=1, status=201, json={**payload, "categoria": " Conducta "}, headers=keyed)
    assert replay == first
    conflict = request("POST", reports, person=1, status=409, json={**payload, "descripcion": "Otro texto."}, headers=keyed)
    assert conflict["codigo"] == "CLAVE_IDEMPOTENCIA_REUTILIZADA"
    request("POST", reports, status=403, json=payload, headers=keyed)
    assert request("GET", mine)["items"] == []

    request("DELETE", f"/conexiones/{connection}", status=204)
    user_report = request("POST", reports, status=201, json={**reason, "id_usuario_reportado": ids[1]})
    assert user_report["tipo"] == "Usuario"
    rental = fixture_overlap(owner, publication, ids[0], ids[2])
    historical = request("POST", reports, status=201, json={**reason, "id_usuario_reportado": ids[2]})
    assert historical["id_reporte"] != user_report["id_reporte"]

    page = request("GET", mine + "?limite=1")
    assert page["items"] == [historical] and page["siguiente_cursor"]
    assert request("GET", mine, params={"cursor": page["siguiente_cursor"]})["items"] == [user_report]
    request("GET", mine, person=1, params={"cursor": page["siguiente_cursor"]}, status=422)
    assert request("GET", mine, person=1)["items"] == [first]
    request("GET", "/internal/conexiones/relacion", status=404, params={"a": ids[0], "b": ids[1]})
    listing_slots = f"/api/publicaciones/{publication}/cupos"
    slots_before = request("GET", listing_slots)
    rental_before = rental_snapshot(owner, rental)
    assert len(rental_before) == 2
    exercise_moderation(owner, request, ids, first)
    exercise_concurrent_moderation(request, send, user_report["id_reporte"])
    assert request("GET", listing_slots) == slots_before
    assert rental_snapshot(owner, rental) == rental_before
    print("PASS SCRUM-96: decisiones concurrentes, bitácora y cupos/pertenencias conservados", flush=True)

    replay = request("POST", reports, person=1, status=201, json=payload, headers=keyed)
    assert replay == {**first, "estado": "Resuelto"}
    second_account = request("POST", reports, person=2, status=201, json=payload, headers=keyed)
    assert second_account["id_reporte"] != first["id_reporte"]
    assert request("GET", mine, person=1)["items"] == [replay]
    assert request("GET", mine, person=2)["items"] == [second_account]
    print("PASS SCRUM-95: idempotencia concurrente, claves por cuenta, permisos y cursor", flush=True)


def exercise_concurrent_moderation(request, send, report_id):
    url = f"/api/admin/reportes/{report_id}"
    initial = request("PATCH", url, json={"estado": "En_Revision"})
    responses = simultaneous_requests(send, "PATCH", url, [{"estado": "Resuelto"}, {"estado": "Descartado"}])
    assert sorted(response.status_code for response in responses) == [200, 409], [response.text for response in responses]
    accepted = next(response.json() for response in responses if response.status_code == 200)
    final = request("GET", url)
    assert final == accepted
    assert final["estado"] in {"Resuelto", "Descartado"}
    assert final["historial"][:1] == initial["historial"]
    assert len(final["historial"]) == 2
    assert final["historial"][1]["estado_anterior"] == "En_Revision"
    assert final["historial"][1]["estado_nuevo"] == final["estado"]


def exercise_moderation(owner, request, ids, report):
    queue = "/api/admin/reportes"
    detail = f"{queue}/{report['id_reporte']}"
    request("GET", queue, person=None, status=401)
    request("GET", queue, person=1, status=403)
    request("GET", detail, person=1, status=403)
    request("PATCH", detail, person=1, status=403, json={"estado": "En_Revision"})
    request("GET", queue + "/2147483647", status=404)
    assert request("GET", queue, params={"estado": "Pendiente", "tipo": "Publicacion"})["items"][0]["id_reporte"] == report["id_reporte"]
    first_page = request("GET", queue, params={"estado": "Pendiente", "limite": 1})
    cursor = first_page["siguiente_cursor"]
    assert cursor
    next_page = request("GET", queue, params={"estado": "Pendiente", "cursor": cursor})
    assert next_page["items"]
    request("GET", queue, status=422, params={"estado": "Resuelto", "cursor": cursor})
    request("GET", "/api/reportes/mios", status=422, params={"cursor": cursor})

    assert request("GET", detail)["historial"] == []
    another_report = first_page["items"][0]["id_reporte"]
    assert another_report != report["id_reporte"]
    another_detail = f"{queue}/{another_report}"
    with psycopg.connect(owner, autocommit=True) as connection:
        connection.execute("REVOKE INSERT(id_actuacion) ON reportes.outbox FROM sql_reportes")
        try:
            request("PATCH", another_detail, status=503, json={"estado": "Descartado"})
        finally:
            connection.execute("GRANT INSERT(id_actuacion) ON reportes.outbox TO sql_reportes")
    unchanged = request("GET", another_detail)
    assert unchanged["estado"] == "Pendiente" and unchanged["historial"] == []
    assert request("PATCH", another_detail, json={"estado": "Descartado"})["estado"] == "Descartado"
    request("PATCH", detail, status=409, json={"estado": "Resuelto"})
    request("PATCH", detail, status=422, json={"estado": "En_Revision", "nota_interna": "\x00"})
    reviewed = request("PATCH", detail, json={"estado": "En_Revision", "nota_interna": "  Nota privada.  "})
    assert reviewed["estado"] == "En_Revision" and reviewed["id_denunciante"] == ids[1]
    entry = reviewed["historial"][0]
    assert entry["id_administrador"] == ids[0] and entry["nota_interna"] == "Nota privada."
    assert (entry["estado_anterior"], entry["estado_nuevo"]) == ("Pendiente", "En_Revision")
    request("PATCH", detail, status=409, json={"estado": "En_Revision"})
    assert request("GET", detail)["historial"] == [entry]
    resolved = request("PATCH", detail, json={"estado": "Resuelto"})
    assert len(resolved["historial"]) == 2 and resolved["historial"][1]["nota_interna"] is None
    request("PATCH", detail, status=409, json={"estado": "Descartado"})
    own_report = request("GET", "/api/reportes/mios", person=1)["items"][0]
    assert own_report == {**report, "estado": "Resuelto"}

    action_ids = [row["id_actuacion"] for row in resolved["historial"]]
    with psycopg.connect(owner, autocommit=True) as connection:
        def wait_for_delivery():
            for _ in range(30):
                total = connection.execute(
                    "SELECT count(*) FROM reportes.outbox WHERE id_actuacion=ANY(%s) AND entregado_en IS NOT NULL",
                    (action_ids,),
                ).fetchone()[0]
                if total == 2:
                    return
                time.sleep(.25)
            raise AssertionError("Las notificaciones quedaron pendientes")

        wait_for_delivery()
        # Simula confirmación perdida entre Auth y la confirmación en la outbox.
        connection.execute("""UPDATE reportes.outbox SET entregado_en=NULL,proximo_intento=clock_timestamp()
            WHERE id_actuacion=%s""", (action_ids[0],))
        wait_for_delivery()

    notices = request("GET", "/local/v1/notificaciones", person=1)
    notices = [row for row in notices if row["tipo"] == "reporte_actualizado"]
    assert len(notices) == 2
    assert {(row["referencia_id"], row["estado"]) for row in notices} == {
        (report["id_reporte"], "En_Revision"), (report["id_reporte"], "Resuelto"),
    }
    assert all("nota_interna" not in row for row in notices)
    request("POST", "/internal/notificaciones", status=404, json={})
    print("PASS SCRUM-96: permisos, filtros, cursor, transiciones, bitácora y notificación sin duplicados", flush=True)
