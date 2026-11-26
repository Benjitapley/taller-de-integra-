"""Incorporación con reserva firme, respuesta durable y compensación por outbox."""
from uuid import UUID, uuid4

from psycopg.types.json import Jsonb

from app.models import Incorporation, Reservation, ServiceError, unavailable


class Convivencia:
    def __init__(self, repository, identity, publications):
        self.repository, self.identity, self.publications = repository, identity, publications

    def dispatch_expulsions(self):
        delivered = 0
        with self.repository.transaction() as c:
            events = c.execute("SELECT * FROM convivencia_mensajeria.expulsion_outbox WHERE NOT enviado ORDER BY id_expulsion LIMIT 20 FOR UPDATE SKIP LOCKED").fetchall()
            for event in events:
                try:
                    self.publications.expulsion_occupancy(event["id_publicacion"], event["proyeccion"])
                except Exception:
                    continue
                c.execute("UPDATE convivencia_mensajeria.expulsion_outbox SET enviado=true WHERE id_expulsion=%s", (event["id_expulsion"],))
                delivered += 1
        return delivered + self.dispatch_departures()

    def incorporate(self, key: UUID, payload: dict):
        result = self._incorporate(key, payload)
        if result[0] >= 400:
            # Un rechazo no queda visible como final mientras retenga el cupo remoto.
            self.dispatch(key)
            with self.repository.transaction() as c:
                pending = c.execute("SELECT 1 FROM convivencia_mensajeria.outbox WHERE id_operacion=%s AND accion='Liberar' AND NOT enviado", (key,)).fetchone()
            if pending:
                raise unavailable()
        return result

    def _incorporate(self, key: UUID, payload: dict):
        payload = Incorporation.model_validate(payload).model_dump()
        self.repository.begin(key, payload)
        # La intención de reservar se confirma antes del HTTP: una respuesta perdida
        # obliga a resolver esa reserva aun si después cambia la habilitación.
        with self.repository.transaction() as c:
            operation = c.execute("SELECT * FROM convivencia_mensajeria.incorporacion WHERE id_operacion=%s FOR UPDATE", (key,)).fetchone()
            if operation["payload"] != payload:
                raise ServiceError("IDEMPOTENCY_CONFLICT", "La clave ya fue usada con otro payload.")
            if operation["estado"] != "Pendiente":
                return operation["http_status"], operation["respuesta"], True
            if operation["etapa"] == "ValidarIdentidad":
                enabled = self.identity.enabled(payload["id_usuario"])
                if type(enabled) is not bool:
                    raise unavailable()
                if not enabled:
                    error = ServiceError("USER_NOT_ENABLED", "El usuario no está habilitado.", 403)
                    self._reject(c, key, error)
                    return error.status, error.body, False
                c.execute("UPDATE convivencia_mensajeria.incorporacion SET etapa='Reservar' WHERE id_operacion=%s", (key,))
        with self.repository.transaction() as c:
            operation = c.execute("SELECT * FROM convivencia_mensajeria.incorporacion WHERE id_operacion=%s FOR UPDATE", (key,)).fetchone()
            if operation["payload"] != payload:
                raise ServiceError("IDEMPOTENCY_CONFLICT", "La clave ya fue usada con otro payload.")
            if operation["estado"] != "Pendiente":
                return operation["http_status"], operation["respuesta"], True
            # Orden común para todas las admisiones; la fila serializa reintentos de una operación.
            c.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s,0))", (f"usuario:{payload['id_usuario']}",))
            c.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s,0))", (f"publicacion:{payload['id_publicacion']}",))
            c.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s,0))", (f"postulacion:{payload['id_postulacion']}",))
            reservation = None
            try:
                reservation = Reservation.model_validate(self.publications.reserve(key, payload)).model_dump(mode="json")
                if {k: reservation[k] for k in payload} != payload:
                    raise unavailable()
                enabled = self.identity.enabled(payload["id_usuario"])
                if type(enabled) is not bool:
                    raise unavailable()
                if not enabled:
                    raise ServiceError("USER_NOT_ENABLED", "El usuario no está habilitado.", 403)
                if c.execute("SELECT 1 FROM convivencia_mensajeria.pertenencia WHERE id_usuario=%s AND estado='Activa'", (payload["id_usuario"],)).fetchone():
                    raise ServiceError("USER_ALREADY_ACTIVE", "El usuario ya tiene una pertenencia activa.")
                if c.execute("SELECT 1 FROM convivencia_mensajeria.pertenencia WHERE id_postulacion=%s", (payload["id_postulacion"],)).fetchone():
                    raise ServiceError("APPLICATION_ALREADY_PROCESSED", "La postulación ya fue incorporada.")
                rental = c.execute("SELECT * FROM convivencia_mensajeria.arriendo WHERE id_publicacion=%s FOR UPDATE", (payload["id_publicacion"],)).fetchone()
                if rental is None:
                    rental = c.execute("""INSERT INTO convivencia_mensajeria.arriendo(id_publicacion,cupos_totales,version_capacidad)
                      VALUES(%s,%s,%s) RETURNING *""", (payload["id_publicacion"], reservation["cupos_totales"], payload["version_capacidad"])).fetchone()
                if c.execute("SELECT 1 FROM convivencia_mensajeria.pertenencia WHERE id_arriendo=%s AND id_usuario=%s AND estado='Inactiva'", (rental["id_arriendo"],payload["id_usuario"])).fetchone():
                    raise ServiceError("REENTRY_FORBIDDEN", "No se permite reingresar al arriendo.")
                if rental["estado"] == "Finalizado":
                    raise ServiceError("RENTAL_FINALIZED", "El arriendo ha finalizado.")
                if rental["version_capacidad"] != payload["version_capacidad"] or rental["cupos_totales"] != reservation["cupos_totales"]:
                    raise ServiceError("CAPACITY_VERSION_CONFLICT", "La versión de capacidad no coincide.")
                c.execute("INSERT INTO convivencia_mensajeria.conversacion(id_arriendo) VALUES(%s) ON CONFLICT(id_arriendo) DO NOTHING", (rental["id_arriendo"],))
                occupied = c.execute("SELECT count(*) AS total FROM convivencia_mensajeria.pertenencia WHERE id_arriendo=%s AND estado='Activa'", (rental["id_arriendo"],)).fetchone()["total"]
                if occupied >= rental["cupos_totales"]:
                    raise ServiceError("NO_CAPACITY", "No quedan cupos disponibles.")
                c.execute("""INSERT INTO convivencia_mensajeria.pertenencia(id_arriendo,id_usuario,id_postulacion,id_operacion)
                  VALUES(%s,%s,%s,%s)""", (rental["id_arriendo"], payload["id_usuario"], payload["id_postulacion"], key))
                version = c.execute("UPDATE convivencia_mensajeria.arriendo SET version_ocupacion=version_ocupacion+1 WHERE id_arriendo=%s RETURNING version_ocupacion", (rental["id_arriendo"],)).fetchone()["version_ocupacion"]
                body = {"id_incorporacion": str(key), "id_arriendo": rental["id_arriendo"], "id_publicacion": payload["id_publicacion"], "id_usuario": payload["id_usuario"], "estado": "Activa", "confirmacion_publicacion": "Pendiente"}
                self._outbox(c, key, "Confirmar", {**reservation, "confirmacion": {"id_arriendo": rental["id_arriendo"], "ocupacion": occupied + 1, "version_ocupacion": version}})
                c.execute("UPDATE convivencia_mensajeria.incorporacion SET estado='Terminada',http_status=201,respuesta=%s WHERE id_operacion=%s", (Jsonb(body), key))
                return 201, body, False
            except ServiceError as error:
                if error.status == 503:
                    raise
                if reservation is not None:
                    self._outbox(c, key, "Liberar", reservation)
                self._reject(c, key, error)
                return error.status, error.body, False

    @staticmethod
    def _reject(c, key, error):
        c.execute("UPDATE convivencia_mensajeria.incorporacion SET estado='Rechazada',http_status=%s,respuesta=%s WHERE id_operacion=%s", (error.status, Jsonb(error.body), key))

    @staticmethod
    def _outbox(c, key, action, reservation):
        c.execute("""INSERT INTO convivencia_mensajeria.outbox(id_operacion,accion,reserva) VALUES(%s,%s,%s)
          ON CONFLICT(id_operacion,accion) DO NOTHING""", (key, action, Jsonb(reservation)))

    @staticmethod
    def _legacy_confirmation(c, event):
        row = c.execute("""SELECT a.id_arriendo,a.version_ocupacion,
            (SELECT count(*) FROM convivencia_mensajeria.pertenencia p WHERE p.id_arriendo=a.id_arriendo AND p.estado='Activa') AS ocupacion
            FROM convivencia_mensajeria.pertenencia p JOIN convivencia_mensajeria.arriendo a USING(id_arriendo)
            WHERE p.id_operacion=%s AND p.id_usuario=%s AND a.id_publicacion=%s AND p.estado='Activa'
            FOR UPDATE OF a""", (event["id_operacion"], event["reserva"]["id_usuario"], event["reserva"]["id_publicacion"])).fetchone()
        if row is None or row["version_ocupacion"] < 1:
            raise unavailable()
        reservation = {**event["reserva"], "confirmacion": dict(row)}
        c.execute("UPDATE convivencia_mensajeria.outbox SET reserva=%s WHERE id_outbox=%s", (Jsonb(reservation), event["id_outbox"]))
        return reservation

    def dispatch(self, key=None):
        delivered = 0
        with self.repository.transaction() as c:
            condition = " AND id_operacion=%s" if key is not None else ""
            events = c.execute("SELECT * FROM convivencia_mensajeria.outbox WHERE NOT enviado" + condition + " ORDER BY ultimo_intento NULLS FIRST,id_outbox LIMIT 20 FOR UPDATE SKIP LOCKED", (key,) if key is not None else ()).fetchall()
            for event in events:
                c.execute("UPDATE convivencia_mensajeria.outbox SET ultimo_intento=clock_timestamp() WHERE id_outbox=%s", (event["id_outbox"],))
                try:
                    reservation = event["reserva"]
                    if event["accion"] == "Confirmar" and "confirmacion" not in reservation:
                        reservation = self._legacy_confirmation(c, event)
                    method = self.publications.confirm if event["accion"] == "Confirmar" else self.publications.release
                    method(event["id_operacion"], reservation)
                except Exception:
                    continue  # La reserva firme persiste hasta confirmar o liberar con la misma clave.
                c.execute("UPDATE convivencia_mensajeria.outbox SET enviado=true WHERE id_outbox=%s", (event["id_outbox"],))
                delivered += 1
        return delivered

    def recover(self):
        for operation in self.repository.pending():
            try:
                self._incorporate(operation["id_operacion"], operation["payload"])
            except Exception:
                continue
        return self.dispatch() + self.dispatch_expulsions()


    def expel(self, rental_id, actor_id, data, reason=None):
        from uuid import uuid4
        from app.models import Expulsion
        if reason is not None:
            data = {"id_usuario": data, "motivo": reason, "confirmo": True}
        data = Expulsion.model_validate(data).model_dump()
        with self.repository.transaction() as c:
            row = c.execute("SELECT * FROM convivencia_mensajeria.arriendo WHERE id_arriendo=%s", (rental_id,)).fetchone()
            if row is None:
                raise ServiceError("RENTAL_NOT_FOUND", "Arriendo no encontrado.", 404)
            if self.publications.owner(row["id_publicacion"]) != actor_id:
                raise ServiceError("FORBIDDEN", "Solo el dueño del aviso puede retirar integrantes.", 403)
            c.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s,0))", (f"publicacion:{row['id_publicacion']}",))
            row = c.execute("SELECT * FROM convivencia_mensajeria.arriendo WHERE id_arriendo=%s FOR UPDATE", (rental_id,)).fetchone()
            previous = c.execute("SELECT motivo,respuesta FROM convivencia_mensajeria.retiro WHERE id_arriendo=%s AND id_usuario=%s", (rental_id,data["id_usuario"])).fetchone()
            if previous is None:
                # Los retiros de E03 anteriores al merge conservan su respuesta durable.
                previous = c.execute("SELECT motivo,respuesta FROM convivencia_mensajeria.expulsion WHERE id_arriendo=%s AND id_usuario=%s", (rental_id,data["id_usuario"])).fetchone()
            if previous:
                if previous["motivo"] != data["motivo"]:
                    raise ServiceError("EXPULSION_CONFLICT", "El retiro ya fue registrado con otro motivo.", 409)
                return previous["respuesta"]
            member = c.execute("SELECT * FROM convivencia_mensajeria.pertenencia WHERE id_arriendo=%s AND id_usuario=%s AND estado='Activa' FOR UPDATE", (rental_id,data["id_usuario"])).fetchone()
            if member is None:
                raise ServiceError("MEMBER_NOT_FOUND", "Integrante activo no encontrado.", 404)
            c.execute("UPDATE convivencia_mensajeria.pertenencia SET estado='Inactiva' WHERE id_pertenencia=%s", (member["id_pertenencia"],))
            c.execute("UPDATE convivencia_mensajeria.tarea SET id_asignado=NULL WHERE id_arriendo=%s AND id_asignado=%s AND estado='Pendiente'", (rental_id,data["id_usuario"]))
            count = c.execute("SELECT count(*) AS n FROM convivencia_mensajeria.pertenencia WHERE id_arriendo=%s AND estado='Activa'", (rental_id,)).fetchone()["n"]
            version = c.execute("UPDATE convivencia_mensajeria.arriendo SET version_ocupacion=version_ocupacion+1,estado=%s WHERE id_arriendo=%s RETURNING version_ocupacion", ('Finalizado' if count == 0 else 'Activo',rental_id)).fetchone()["version_ocupacion"]
            key = uuid4()
            body = {"id_arriendo":rental_id,"id_usuario":data["id_usuario"],"estado":"Finalizado" if count == 0 else "Activo", "integrantes_activos":count,"cupos_disponibles":row["cupos_totales"]-count}
            c.execute("INSERT INTO convivencia_mensajeria.retiro(id_retiro,id_arriendo,id_usuario,id_actor,motivo,respuesta) VALUES(%s,%s,%s,%s,%s,%s)", (key,rental_id,data["id_usuario"],actor_id,data["motivo"],Jsonb(body)))
            projection = {"id_publicacion":row["id_publicacion"],"ocupacion":count,"version_ocupacion":version,"finalizado":count == 0}
            notice = {"tipo":"expulsion","event_key":f"expulsion:{key}","id_usuario":data["id_usuario"],"referencia_id":rental_id}
            for action,payload in (("Ocupacion",projection),("Notificar",notice)):
                c.execute("INSERT INTO convivencia_mensajeria.retiro_outbox(id_retiro,accion,payload) VALUES(%s,%s,%s)", (key,action,Jsonb(payload)))
        self.dispatch_expulsions()
        return body

    def dispatch_departures(self):
        from backend.service_runtime.notifications import send_notification
        delivered = 0
        with self.repository.transaction() as c:
            events = c.execute("SELECT * FROM convivencia_mensajeria.retiro_outbox WHERE NOT enviado ORDER BY ultimo_intento NULLS FIRST,id_retiro,accion LIMIT 20 FOR UPDATE SKIP LOCKED").fetchall()
            for event in events:
                c.execute("UPDATE convivencia_mensajeria.retiro_outbox SET ultimo_intento=clock_timestamp() WHERE id_retiro=%s AND accion=%s", (event["id_retiro"],event["accion"]))
                try:
                    if event["accion"] == "Ocupacion":
                        self.publications.occupancy(event["payload"])
                    else:
                        send_notification(event["payload"])
                except Exception:
                    continue
                c.execute("UPDATE convivencia_mensajeria.retiro_outbox SET enviado=true WHERE id_retiro=%s AND accion=%s", (event["id_retiro"],event["accion"]))
                delivered += 1
        return delivered
