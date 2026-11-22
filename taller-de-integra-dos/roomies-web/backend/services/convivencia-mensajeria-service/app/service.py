"""Incorporación con reserva firme, respuesta durable y compensación por outbox."""
from uuid import UUID

from psycopg.types.json import Jsonb

from app.models import Incorporation, Reservation, ServiceError, unavailable


class Convivencia:
    def __init__(self, repository, identity, publications):
        self.repository, self.identity, self.publications = repository, identity, publications

    def members(self, rental_id, user_id, active_only=True):
        publication_id = self.repository.publication(rental_id)
        owner = getattr(self.publications, "owner", None)
        if callable(owner) and owner(publication_id) == user_id:
            return self.repository.members(rental_id, user_id, active_only, access_checked=True)
        return self.repository.members(rental_id, user_id, active_only)

    def expel(self, rental_id, actor_id, payload):
        publication_id = self.repository.publication(rental_id)
        owner = getattr(self.publications, "owner", None)
        if not callable(owner) or owner(publication_id) != actor_id:
            raise ServiceError("FORBIDDEN", "Solo el dueño del aviso puede retirar integrantes.", 403)
        return self.repository.expel(rental_id, actor_id, payload)

    def incorporate(self, key: UUID, payload: dict):
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
                if rental["version_capacidad"] != payload["version_capacidad"] or rental["cupos_totales"] != reservation["cupos_totales"]:
                    raise ServiceError("CAPACITY_VERSION_CONFLICT", "La versión de capacidad no coincide.")
                occupied = c.execute("SELECT count(*) AS total FROM convivencia_mensajeria.pertenencia WHERE id_arriendo=%s AND estado='Activa'", (rental["id_arriendo"],)).fetchone()["total"]
                if occupied >= rental["cupos_totales"]:
                    raise ServiceError("NO_CAPACITY", "No quedan cupos disponibles.")
                c.execute("""INSERT INTO convivencia_mensajeria.pertenencia(id_arriendo,id_usuario,id_postulacion,id_operacion)
                  VALUES(%s,%s,%s,%s)""", (rental["id_arriendo"], payload["id_usuario"], payload["id_postulacion"], key))
                body = {"id_incorporacion": str(key), "id_arriendo": rental["id_arriendo"], "id_publicacion": payload["id_publicacion"], "id_usuario": payload["id_usuario"], "estado": "Activa", "confirmacion_publicacion": "Pendiente"}
                self._outbox(c, key, "Confirmar", reservation)
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

    def dispatch(self):
        delivered = 0
        with self.repository.transaction() as c:
            events = c.execute("SELECT * FROM convivencia_mensajeria.outbox WHERE NOT enviado ORDER BY ultimo_intento NULLS FIRST,id_outbox LIMIT 20 FOR UPDATE SKIP LOCKED").fetchall()
            for event in events:
                c.execute("UPDATE convivencia_mensajeria.outbox SET ultimo_intento=clock_timestamp() WHERE id_outbox=%s", (event["id_outbox"],))
                try:
                    method = self.publications.confirm if event["accion"] == "Confirmar" else self.publications.release
                    method(event["id_operacion"], event["reserva"])
                except Exception:
                    continue  # La reserva firme persiste hasta confirmar o liberar con la misma clave.
                c.execute("UPDATE convivencia_mensajeria.outbox SET enviado=true WHERE id_outbox=%s", (event["id_outbox"],))
                delivered += 1
        return delivered

    def recover(self):
        for operation in self.repository.pending():
            try:
                self.incorporate(operation["id_operacion"], operation["payload"])
            except Exception:
                continue
        return self.dispatch()
