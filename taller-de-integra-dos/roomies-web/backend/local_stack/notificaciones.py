"""Pruebas de entrega contra Auth/Users real del laboratorio desechable."""
import time
from uuid import uuid4

import jwt
import psycopg


def exercise_notifications(owner, request, client, auth_origin, keys, ids, legacy_token):
    internal = auth_origin + "/internal/notificaciones"
    listing_key = keys["LISTADO_AUTH_JWT_KEY"]
    convivencia_key = keys["CONVIVENCIA_AUTH_JWT_KEY"]

    def send(event, issuer, key, status=200):
        now = int(time.time())
        token = jwt.encode({"iss": issuer, "aud": "auth-users", "iat": now, "exp": now + 60}, key, algorithm="HS256")
        response = client.post(internal, json=event, headers={
            "Authorization": f"Bearer {token}", "Idempotency-Key": event["event_key"],
        })
        assert response.status_code == status, (response.status_code, response.text)
        if status == 200:
            assert response.json() == {"success": True}

    with psycopg.connect(owner, autocommit=True) as connection:
        stored = connection.execute("""SELECT event_key,id_usuario,referencia_id,estado
            FROM listado_applications.outbox WHERE id_usuario=%s AND enviado ORDER BY event_key LIMIT 1""", (ids[1],)).fetchone()
        assert stored
        application = dict(zip(("event_key", "id_usuario", "referencia_id", "estado"), stored))
        # Simula el acuse perdido después de que Auth ya persistió el aviso.
        connection.execute("UPDATE listado_applications.outbox SET enviado=false WHERE event_key=%s", (application["event_key"],))
        for _ in range(40):
            if connection.execute("SELECT enviado FROM listado_applications.outbox WHERE event_key=%s",
                                  (application["event_key"],)).fetchone()[0]:
                break
            time.sleep(.15)
        else:
            raise AssertionError("Listado no confirmó el reenvío")
        assert connection.execute("SELECT count(*) FROM auth_users.notificacion WHERE event_key=%s",
                                  (application["event_key"],)).fetchone()[0] == 1

    canonical = {**application, "tipo": "postulacion_resultado"}
    send(canonical, "listado-applications", listing_key)
    send({**canonical, "id_usuario": ids[2]}, "listado-applications", listing_key, status=409)
    for event, status in ((application, 200), ({**application, "id_usuario": ids[2]}, 409)):
        result = client.post(internal.replace("/internal/", "/internal/v1/"), json=event,
                             headers={"X-Roomies-Service": legacy_token})
        assert result.status_code == status

    # Convivencia todavía no expone la operación de expulsión en esta rama.
    departure = {"tipo": "expulsion", "event_key": f"expulsion:{uuid4()}", "id_usuario": ids[2], "referencia_id": 1}
    send(departure, "listado-applications", listing_key, status=403)
    send({**departure, "estado": "Activa"}, "convivencia-mensajeria", convivencia_key, status=422)
    send(departure, "convivencia-mensajeria", convivencia_key)
    send({**departure, "estado": "Expulsado"}, "convivencia-mensajeria", convivencia_key)
    send({**departure, "referencia_id": 2}, "convivencia-mensajeria", convivencia_key, status=409)

    own_route = "/api/notificaciones"
    request("GET", own_route, person=None, status=401)
    notices = request("GET", own_route, person=2)["items"]
    assert [row["referencia_id"] for row in notices if row["tipo"] == "expulsion"] == [departure["referencia_id"]]
    full = request("GET", own_route, person=1)
    assert full["siguiente_cursor"] is None
    assert {row["tipo"] for row in full["items"]} == {"postulacion_resultado", "reporte_actualizado"}
    assert all(set(row) == {"id_notificacion", "tipo", "referencia_id", "fecha"} for row in full["items"])
    page = request("GET", own_route, person=1, params={"limite": 1})
    cursor = page["siguiente_cursor"]
    assert page["items"] == full["items"][:1] and cursor
    assert request("GET", own_route, person=1, params={"cursor": cursor})["items"] == full["items"][1:]
    request("GET", own_route, person=2, status=422, params={"cursor": cursor})
    request("GET", own_route, person=1, status=422, params={"cursor": "inválido"})
    print("PASS SCRUM-97: avisos privados, cursor, reenvíos deduplicados, compatibilidad y aislamiento de emisores", flush=True)
