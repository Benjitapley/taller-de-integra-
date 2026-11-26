"""Aceptación E05 por Gateway real y PostgreSQL desechable de run_c03.

Solo el proveedor externo de identidad es ficticio. Listado, Convivencia,
Auth/Users, Gateway, transacciones, avisos y worker de outbox son reales.
"""
from concurrent.futures import ThreadPoolExecutor
from uuid import uuid4

from run_c03 import eventually


def exercise_departures(client, gateway, people, database, identity, callbacks, restart, internal_token):
    def request(method, path, person=0, expected=(200,), **kwargs):
        response = client.request(method, gateway + path, headers={
            "Authorization": "Bearer " + people[person]["access_token"],
            **kwargs.pop("headers", {}),
        }, **kwargs)
        assert response.status_code in expected, (method, path, response.status_code, response.text[:300])
        return response.json()

    owner, first, second = [people[i]["business_id"] for i in (0, 1, 2)]
    identity.users["c03-8@example.com"]["user"]["app_metadata"] = {"rol": "admin"}
    # Acreditar que la cuenta realmente tiene rol admin antes de probar su 403.
    request("GET", "/api/admin/publicaciones", 9, (403,))
    request("GET", "/api/admin/publicaciones", 8)
    form = {"titulo": "Arriendo E05 integrado", "descripcion": "Datos ficticios locales",
            "ubicacion": "Temuco", "precio": "250000", "tipo": "Arrendador",
            "categoria": "ofrezco", "tipo_vivienda": "habitacion", "mascota": "no",
            "cupos_totales": "2", "id_region": "9", "id_comuna": "9101"}
    pub = request("POST", "/api/publicaciones", expected=(201,), data=form)["id_publicacion"]
    rentals = []
    for person in (1, 2):
        application = request("POST", f"/api/publicaciones/{pub}/postulaciones", person, (201,))["id_postulacion"]
        request("PATCH", f"/api/postulaciones/{application}/estado", json={"estado": "Preseleccionada"})
        request("PATCH", f"/api/postulaciones/{application}/estado", expected=(200, 202),
                headers={"Idempotency-Key": str(uuid4())}, json={"estado": "Aceptada"})

        def accepted():
            row = request("GET", f"/api/postulaciones/{application}")
            return row if row["estado"] == "Aceptada" else None

        rentals.append(eventually(accepted)["id_arriendo"])
    assert rentals[0] == rentals[1]
    rental = rentals[0]
    base = f"/api/arriendos/{rental}"
    expel = base + "/expulsiones"
    data = {"id_usuario": first, "motivo": "Incumplimiento de reglas", "confirmo": True}

    assert request("GET", base + "/integrantes")["puede_retirar"] is True
    assert request("GET", base + "/integrantes", 1)["puede_retirar"] is False
    for person in (1, 8, 9):
        request("POST", expel, person, (403,), json=data)
    for invalid in ({"motivo": ""}, {"motivo": "   "}, {"confirmo": False}, {"confirmo": "true"}):
        request("POST", expel, expected=(422,), json={**data, **invalid})
    assert request("GET", base)["ocupacion"] == 2
    print("PASS E05 dueño exclusivo, admin real ajeno=403, motivo/confirmación=422", flush=True)

    def task(title):
        return request("POST", base + "/tareas", 2, (201,),
                       json={"titulo": title, "descripcion": None, "id_asignado": first})

    pending, completed = task("Pendiente reasignable"), task("Completada conservada")
    request("PATCH", f"/api/tareas/{completed['id_tarea']}/estado", 1, json={"estado": "Completada"})
    conversation = request("GET", "/api/conversaciones", 1)["items"][0]["id_conversacion"]
    messages = f"/api/conversaciones/{conversation}/mensajes"
    request("POST", messages, 1, json={"contenido": "Mensaje previo al retiro", "id_cliente": str(uuid4())})
    for person in (0, 8):
        request("GET", messages, person, (403,))
        request("GET", base + "/tareas", person, (403,))

    # Impedir solo la proyección: propiedad e identidad siguen siendo consultables.
    callbacks.set("unavailable")
    with ThreadPoolExecutor(max_workers=2) as pool:
        results = list(pool.map(lambda _: request("POST", expel, json=data), range(2)))
    assert results[0] == results[1]
    assert results[0]["cupos_disponibles"] == results[0]["integrantes_activos"] == 1
    assert database.execute("SELECT count(*) FROM convivencia_mensajeria.retiro WHERE id_arriendo=%s", (rental,)).fetchone()[0] == 1
    audit = database.execute("SELECT id_actor,motivo,fecha FROM convivencia_mensajeria.retiro WHERE id_arriendo=%s", (rental,)).fetchone()
    assert audit[0] == owner and audit[1] == data["motivo"] and audit[2] is not None
    assert request("GET", base, 2)["id_responsable"] is None
    request("GET", "/api/arriendos/mio", 1, (404,))
    for method, path, kwargs in (
        ("GET", messages, {}),
        ("POST", messages, {"json": {"contenido": "No permitido", "id_cliente": str(uuid4())}}),
        ("GET", base + "/tareas", {}),
        ("POST", base + "/tareas", {"json": {"titulo": "No permitido", "id_asignado": None}}),
        ("PATCH", f"/api/tareas/{completed['id_tarea']}/estado", {"json": {"estado": "Completada"}}),
    ):
        request(method, path, 1, (403,), **kwargs)
    tasks = {row["id_tarea"]: row for row in request("GET", base + "/tareas", 2)["items"]}
    assert tasks[pending["id_tarea"]]["id_asignado"] is None
    assert tasks[completed["id_tarea"]]["id_asignado"] == first
    assert tasks[completed["id_tarea"]]["estado"] == "Completada"
    request("PATCH", f"/api/tareas/{pending['id_tarea']}", 2, json={"id_asignado": second})
    request("PATCH", f"/api/tareas/{pending['id_tarea']}/estado", 2, json={"estado": "Completada"})
    assert database.execute("SELECT count(*) FROM convivencia_mensajeria.retiro_outbox WHERE accion='Ocupacion' AND NOT enviado").fetchone()[0] == 1
    print("PASS E05 doble retiro libera uno; revoca chat/historial/tareas; vacancia y reasignación persistidas", flush=True)

    restart("convivencia")
    callbacks.set("pass")
    eventually(lambda: request("GET", f"/api/publicaciones/{pub}")["cupos_disponibles"] == 1)
    eventually(lambda: database.execute("SELECT count(*) FROM convivencia_mensajeria.retiro_outbox WHERE NOT enviado").fetchone()[0] == 0)
    assert database.execute("SELECT count(*) FROM auth_users.notificacion WHERE tipo='expulsion' AND id_usuario=%s", (first,)).fetchone()[0] == 1
    assert request("POST", expel, json=data) == results[0]
    print("PASS E05 caída de Listado y reinicio de Convivencia recuperan outbox y aviso único", flush=True)

    # El último retiro compite con envío/completado. Las operaciones pueden
    # precederlo o recibir 403, pero nada queda pendiente asignado al retirado.
    race_task = request("POST", base + "/tareas", 2, (201,),
                        json={"titulo": "Tarea concurrente", "id_asignado": second})
    def last():
        return request("POST", expel, json={**data, "id_usuario": second})
    def send():
        return request("POST", messages, 2, (200, 403),
                       json={"contenido": "Mensaje concurrente", "id_cliente": str(uuid4())})
    def complete():
        return request("PATCH", f"/api/tareas/{race_task['id_tarea']}/estado", 2, (200, 403),
                       json={"estado": "Completada"})
    with ThreadPoolExecutor(max_workers=3) as pool:
        futures = [pool.submit(action) for action in (last, send, complete)]
        final, _, _ = [future.result() for future in futures]
    assert final["estado"] == "Finalizado" and final["integrantes_activos"] == 0
    eventually(lambda: request("GET", f"/api/publicaciones/{pub}")["estado"] == "Cerrada")
    eventually(lambda: database.execute("SELECT count(*) FROM convivencia_mensajeria.retiro_outbox WHERE NOT enviado").fetchone()[0] == 0)
    request("GET", messages, 2, (403,))
    request("POST", messages, 2, (403,), json={"contenido": "Después del commit", "id_cliente": str(uuid4())})
    request("GET", base + "/tareas", 2, (403,))
    request("GET", "/api/arriendos/mio", 2, (404,))
    assert database.execute("SELECT count(*) FROM convivencia_mensajeria.tarea WHERE id_arriendo=%s AND estado='Pendiente' AND id_asignado IS NOT NULL", (rental,)).fetchone()[0] == 0
    restart("listado")
    restart("convivencia")
    assert request("GET", base)["estado"] == "Finalizado"
    assert request("GET", f"/api/publicaciones/{pub}")["estado"] == "Cerrada"
    # Una confirmación retrasada de ingreso no reabre el aviso ni repone cupos.
    delayed = client.put(callbacks.target + f"/internal/publicaciones/{pub}/ocupacion",
                         headers={"X-Roomies-Service": internal_token},
                         json={"ocupacion": 2, "version_ocupacion": 2, "finalizado": False})
    assert delayed.status_code == 200
    assert request("GET", f"/api/publicaciones/{pub}")["estado"] == "Cerrada"
    assert database.execute("SELECT ocupacion_confirmada FROM listado_applications.publicacion WHERE id_publicacion=%s", (pub,)).fetchone()[0] == 0
    assert database.execute("SELECT count(*) FROM auth_users.notificacion WHERE tipo='expulsion'").fetchone()[0] == 2
    print("PASS E05 retiro concurrente con chat/tarea; último finaliza y cierre sobrevive reinicios", flush=True)
