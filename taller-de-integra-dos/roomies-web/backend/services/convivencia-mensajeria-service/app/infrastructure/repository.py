"""Persistencia privada de Convivencia/Mensajería."""
from contextlib import contextmanager
import json

import psycopg
from psycopg.rows import dict_row

from backend.service_runtime.contracts import RuleViolation
from backend.service_runtime.settings import database_url


class PostgresConvivencia:
    def __init__(self):
        self.connection = None

    def connect(self):
        return psycopg.connect(
            database_url("CONVIVENCIA_DATABASE_URL", "sql_convivencia_mensajeria"),
            row_factory=dict_row,
            connect_timeout=3,
            prepare_threshold=None,
        )

    @contextmanager
    def transaction(self):
        with self.connect() as connection:
            self.connection = connection
            try:
                yield self
            finally:
                self.connection = None

    def query(self, sql, params=(), many=False):
        if self.connection is not None:
            cursor = self.connection.execute(sql, params)
            return cursor.fetchall() if many else cursor.fetchone()
        with self.connect() as connection:
            cursor = connection.execute(sql, params)
            return cursor.fetchall() if many else cursor.fetchone()

    def command(self, event_key, fingerprint):
        row = self.query(
            "SELECT huella,respuesta FROM convivencia_mensajeria.comando "
            "WHERE clave=%s",
            (event_key,),
        )
        if row is None:
            return None
        if row["huella"] != fingerprint:
            raise RuleViolation("La clave de idempotencia ya se usó con otros datos.", 409)
        return row["respuesta"]

    def incorporate(self, event_key, fingerprint, reservation):
        publication_id = reservation.publication_id
        applicant_id = reservation.applicant_id
        try:
            with self.transaction():
                previous = self.query(
                    "SELECT huella,respuesta FROM convivencia_mensajeria.comando "
                    "WHERE clave=%s FOR UPDATE",
                    (event_key,),
                )
                if previous is not None:
                    if previous["huella"] != fingerprint:
                        raise RuleViolation(
                            "La clave de idempotencia ya se usó con otros datos.", 409
                        )
                    return previous["respuesta"]

                rental = self.query(
                    "INSERT INTO convivencia_mensajeria.arriendo "
                    "(id_publicacion,id_arrendador,capacidad,version_ocupacion) "
                    "VALUES (%s,%s,%s,%s) ON CONFLICT (id_publicacion) DO NOTHING "
                    "RETURNING id_arriendo",
                    (
                        publication_id,
                        reservation.owner_id,
                        reservation.capacity,
                        reservation.version,
                    ),
                )
                rental = self.query(
                    "SELECT * FROM convivencia_mensajeria.arriendo "
                    "WHERE id_publicacion=%s FOR UPDATE",
                    (publication_id,),
                )
                if rental is None:
                    raise RuleViolation("Arriendo no encontrado.", 404                    )
                    previous = self.query(
                        "SELECT huella,respuesta FROM convivencia_mensajeria.comando "
                        "WHERE clave=%s FOR UPDATE",
                        (event_key,),
                    )
                    if previous is not None:
                        if previous["huella"] != fingerprint:
                            raise RuleViolation(
                                "La clave de idempotencia ya se usó con otros datos.", 409
                            )
                        return previous["respuesta"]
                    if (rental["id_arrendador"] != reservation.owner_id
                            or rental["estado"] != "Activo"):
                        raise RuleViolation("La publicación no admite esta incorporación.", 409)
                if applicant_id == rental["id_arrendador"]:
                    raise RuleViolation("El dueño de la publicación no se incorpora como residente.", 403)

                active = self.query(
                    "SELECT id_arriendo FROM convivencia_mensajeria.pertenencia "
                    "WHERE id_usuario=%s AND estado='Activa' FOR UPDATE",
                    (applicant_id,),
                )
                if active is not None:
                    raise RuleViolation("El usuario ya tiene una pertenencia activa.", 409)
                occupied = self.query(
                    "SELECT count(*) AS total FROM convivencia_mensajeria.pertenencia "
                    "WHERE id_arriendo=%s AND estado='Activa'",
                    (rental["id_arriendo"],),
                )["total"]
                if occupied >= reservation.capacity:
                    raise RuleViolation("No quedan cupos disponibles.", 409)
                version = max(rental["version_ocupacion"], reservation.version) + 1
                self.query(
                    "UPDATE convivencia_mensajeria.arriendo SET capacidad=%s "
                    "WHERE id_arriendo=%s RETURNING id_arriendo",
                    (reservation.capacity, rental["id_arriendo"]),
                )

                role = "Responsable" if occupied == 0 else "Integrante"
                membership = self.query(
                    "INSERT INTO convivencia_mensajeria.pertenencia "
                    "(id_arriendo,id_usuario,rol) VALUES (%s,%s,%s) "
                    "RETURNING id_pertenencia,ingreso_en",
                    (rental["id_arriendo"], applicant_id, role),
                )
                conversation = self.query(
                    "INSERT INTO convivencia_mensajeria.conversacion (id_arriendo) "
                    "VALUES (%s) ON CONFLICT (id_arriendo) DO UPDATE "
                    "SET id_arriendo=EXCLUDED.id_arriendo "
                    "RETURNING id_conversacion",
                    (rental["id_arriendo"],),
                )
                occupied += 1
                self.query(
                    "UPDATE convivencia_mensajeria.arriendo SET "
                    "id_responsable=CASE WHEN %s='Responsable' THEN %s ELSE id_responsable END,"
                    "version_ocupacion=%s WHERE id_arriendo=%s RETURNING id_arriendo",
                    (role, applicant_id, version, rental["id_arriendo"]),
                )
                response = {
                    "id_arriendo": rental["id_arriendo"],
                    "id_publicacion": publication_id,
                    "id_pertenencia": membership["id_pertenencia"],
                    "id_conversacion": conversation["id_conversacion"],
                    "estado": "Activa",
                    "rol": role,
                    "cupos_ocupados": occupied,
                    "cupos_totales": reservation.capacity,
                    "version_ocupacion": version,
                }
                payload = {
                    "event_key": f"ocupacion:{publication_id}:{version}",
                    "clave_incorporacion": event_key,
                    "id_publicacion": publication_id,
                    "id_reserva": reservation.reservation_id,
                    "id_usuario": applicant_id,
                    "version_ocupacion": version,
                    "cupos_totales": reservation.capacity,
                    "cupos_ocupados": occupied,
                    "estado": "Activa",
                }
                self._enqueue(f"ocupacion:{publication_id}:{version}", payload)
                self.query(
                    "INSERT INTO convivencia_mensajeria.comando "
                    "(clave,huella,respuesta) VALUES (%s,%s,%s)",
                    (event_key, fingerprint, json.dumps(response)),
                )
                return response
        except psycopg.errors.UniqueViolation:
            raise RuleViolation("El usuario ya tiene una pertenencia activa.", 409) from None

    def _enqueue(self, event_key, payload):
        self.query(
            "INSERT INTO convivencia_mensajeria.outbox (clave,payload) "
            "VALUES (%s,%s) ON CONFLICT (clave) DO NOTHING RETURNING id_evento",
            (event_key, json.dumps(payload)),
        )

    def my_rental(self, user_id):
        return self.query(
            "SELECT a.id_arriendo,a.id_publicacion,a.id_arrendador,a.id_responsable,"
            "a.estado,a.capacidad,a.version_ocupacion,p.id_pertenencia,p.rol,p.ingreso_en,"
            "(SELECT count(*) FROM convivencia_mensajeria.pertenencia x "
            " WHERE x.id_arriendo=a.id_arriendo AND x.estado='Activa') AS cupos_ocupados "
            "FROM convivencia_mensajeria.pertenencia p "
            "JOIN convivencia_mensajeria.arriendo a USING(id_arriendo) "
            "WHERE p.id_usuario=%s AND p.estado='Activa' AND a.estado='Activo'",
            (user_id,),
        )

    def rental_publication_id(self, rental_id):
        row = self.query(
            "SELECT id_publicacion FROM convivencia_mensajeria.arriendo "
            "WHERE id_arriendo=%s",
            (rental_id,),
        )
        if row is None:
            raise RuleViolation("Arriendo no encontrado.", 404)
        return row["id_publicacion"]

    def rental_for_member(self, rental_id, user_id):
        return self.query(
            "SELECT a.id_arriendo,a.id_publicacion,a.id_arrendador,a.id_responsable,a.estado,"
            "a.capacidad,a.version_ocupacion,"
            "(SELECT count(*) FROM convivencia_mensajeria.pertenencia p "
            " WHERE p.id_arriendo=a.id_arriendo AND p.estado='Activa') AS cupos_ocupados "
            "FROM convivencia_mensajeria.arriendo a "
            "JOIN convivencia_mensajeria.pertenencia m USING(id_arriendo) "
            "WHERE a.id_arriendo=%s AND a.estado='Activo' "
            "AND m.id_usuario=%s AND m.estado='Activa'",
            (rental_id, user_id),
        )

    def members(self, rental_id, user_id, before, limit):
        with self.transaction():
            member = self.query(
                "SELECT 1 FROM convivencia_mensajeria.pertenencia "
                "WHERE id_arriendo=%s AND id_usuario=%s AND estado='Activa' FOR SHARE",
                (rental_id, user_id),
            )
            if member is None:
                raise RuleViolation("Arriendo no encontrado.", 404)
            condition = (
                "id_arriendo=%s AND estado='Activa'"
                if before is None
                else "id_arriendo=%s AND estado='Activa' "
                     "AND (ingreso_en,id_pertenencia)<(%s,%s)"
            )
            params = [rental_id]
            if before is not None:
                params.extend(before)
            return self.query(
                "SELECT id_pertenencia,id_usuario,rol,ingreso_en "
                "FROM convivencia_mensajeria.pertenencia "
                "WHERE " + condition
                + " ORDER BY ingreso_en DESC,id_pertenencia DESC LIMIT %s",
                (*params, limit),
                many=True,
            )

    def internal_members(self, rental_id):
        rental = self.query(
            "SELECT id_arriendo,id_publicacion,estado,capacidad,version_ocupacion "
            "FROM convivencia_mensajeria.arriendo WHERE id_arriendo=%s",
            (rental_id,),
        )
        if rental is None:
            raise RuleViolation("Arriendo no encontrado.", 404)
        members = self.query(
            "SELECT id_usuario,rol,ingreso_en FROM convivencia_mensajeria.pertenencia "
            "WHERE id_arriendo=%s AND estado='Activa' ORDER BY ingreso_en,id_pertenencia",
            (rental_id,),
            many=True,
        )
        return {**rental, "cupos_ocupados": len(members), "integrantes": members}

    def conversations(self, user_id, before, limit):
        condition = (
            "m.id_usuario=%s AND m.estado='Activa' AND a.estado='Activo'"
            if before is None
            else "m.id_usuario=%s AND m.estado='Activa' AND a.estado='Activo' "
                 "AND (c.creada_en,c.id_conversacion)<(%s,%s)"
        )
        params = [user_id]
        if before is not None:
            params.extend(before)
        params.append(limit)
        return self.query(
            "SELECT c.id_conversacion,c.id_arriendo,a.id_publicacion,a.estado,"
            "c.creada_en,m.ingreso_en AS ingreso_en,"
            "(SELECT max(x.creado_en) FROM convivencia_mensajeria.mensaje x "
            " WHERE x.id_conversacion=c.id_conversacion AND x.creado_en>=m.ingreso_en) "
            "AS ultimo_mensaje "
            "FROM convivencia_mensajeria.conversacion c "
            "JOIN convivencia_mensajeria.arriendo a USING(id_arriendo) "
            "JOIN convivencia_mensajeria.pertenencia m USING(id_arriendo) "
            "WHERE " + condition
            + " ORDER BY c.creada_en DESC,c.id_conversacion DESC LIMIT %s",
            tuple(params),
            many=True,
        )

    def conversation(self, conversation_id, user_id):
        with self.transaction():
            member = self.query(
                "SELECT m.id_pertenencia,m.ingreso_en FROM "
                "convivencia_mensajeria.conversacion c "
                "JOIN convivencia_mensajeria.pertenencia m USING(id_arriendo) "
                "JOIN convivencia_mensajeria.arriendo a USING(id_arriendo) "
                "WHERE c.id_conversacion=%s AND m.id_usuario=%s "
                "AND m.estado='Activa' AND a.estado='Activo' FOR SHARE OF m",
                (conversation_id, user_id),
            )
            if member is None:
                return None
            conversation = self.query(
                "SELECT id_conversacion,id_arriendo FROM "
                "convivencia_mensajeria.conversacion WHERE id_conversacion=%s",
                (conversation_id,),
            )
            return {**conversation, "id_pertenencia": member["id_pertenencia"],
                    "ingreso_en": member["ingreso_en"]}

    def messages(self, conversation_id, user_id, before, limit):
        with self.transaction():
            member = self.query(
                "SELECT m.ingreso_en FROM convivencia_mensajeria.conversacion c "
                "JOIN convivencia_mensajeria.arriendo a USING(id_arriendo) "
                "JOIN convivencia_mensajeria.pertenencia m USING(id_arriendo) "
                "WHERE c.id_conversacion=%s AND m.id_usuario=%s "
                "AND m.estado='Activa' AND a.estado='Activo' FOR SHARE OF m",
                (conversation_id, user_id),
            )
            if member is None:
                raise RuleViolation("Conversación no encontrada.", 404)
            condition = (
                "id_conversacion=%s AND creado_en>=%s"
                if before is None
                else "id_conversacion=%s AND creado_en>=%s "
                     "AND (creado_en,id_mensaje)<(%s,%s)"
            )
            params = [conversation_id, member["ingreso_en"]]
            if before is not None:
                params.extend(before)
            return self.query(
                "SELECT id_mensaje,id_usuario,id_cliente,contenido,creado_en "
                "FROM convivencia_mensajeria.mensaje WHERE "
                + condition
                + " ORDER BY creado_en DESC,id_mensaje DESC LIMIT %s",
                (*params, limit),
                many=True,
            )

    def send_message(self, conversation_id, user_id, client_message_id, content):
        try:
            with self.transaction():
                member = self.query(
                    "SELECT m.id_pertenencia FROM convivencia_mensajeria.conversacion c "
                    "JOIN convivencia_mensajeria.arriendo a USING(id_arriendo) "
                    "JOIN convivencia_mensajeria.pertenencia m USING(id_arriendo) "
                    "WHERE c.id_conversacion=%s AND m.id_usuario=%s "
                    "AND m.estado='Activa' AND a.estado='Activo' FOR SHARE OF m",
                    (conversation_id, user_id),
                )
                if member is None:
                    raise RuleViolation("Conversación no encontrada.", 404)
                row = self.query(
                    "INSERT INTO convivencia_mensajeria.mensaje "
                    "(id_conversacion,id_usuario,id_cliente,contenido) "
                    "VALUES (%s,%s,%s,%s) ON CONFLICT "
                    "(id_conversacion,id_usuario,id_cliente) DO NOTHING "
                    "RETURNING id_mensaje,id_usuario,id_cliente,contenido,creado_en",
                    (conversation_id, user_id, client_message_id, content),
                )
                if row is None:
                    row = self.query(
                        "SELECT id_mensaje,id_usuario,id_cliente,contenido,creado_en "
                        "FROM convivencia_mensajeria.mensaje "
                        "WHERE id_conversacion=%s AND id_usuario=%s AND id_cliente=%s",
                        (conversation_id, user_id, client_message_id),
                    )
                    if row["contenido"] != content:
                        raise RuleViolation(
                            "El identificador del mensaje ya fue usado.", 409
                        )
                return row
        except psycopg.errors.ForeignKeyViolation:
            raise RuleViolation("Conversación no encontrada.", 404) from None

    def expel(self, rental_id, actor_id, target_id, idempotency_key, reason, fingerprint):
        key = f"retiro:{rental_id}:{idempotency_key}"
        with self.transaction():
            previous = self.query(
                "SELECT huella,respuesta FROM convivencia_mensajeria.comando "
                "WHERE clave=%s FOR UPDATE",
                (key,),
            )
            if previous is not None:
                if previous["huella"] != fingerprint:
                    raise RuleViolation(
                        "La clave de idempotencia ya se usó con otros datos.", 409
                    )
                return previous["respuesta"]
            rental = self.query(
                "SELECT * FROM convivencia_mensajeria.arriendo "
                "WHERE id_arriendo=%s FOR UPDATE",
                (rental_id,),
            )
            previous = self.query(
                "SELECT huella,respuesta FROM convivencia_mensajeria.comando "
                "WHERE clave=%s FOR UPDATE",
                (key,),
            )
            if previous is not None:
                if previous["huella"] != fingerprint:
                    raise RuleViolation(
                        "La clave de idempotencia ya se usó con otros datos.", 409
                    )
                return previous["respuesta"]
            if rental is None or rental["estado"] != "Activo":
                raise RuleViolation("Arriendo no encontrado.", 404)
            if rental["id_arrendador"] != actor_id:
                raise RuleViolation("Solo el dueño de la publicación puede retirar integrantes.", 403)
            target = self.query(
                "SELECT id_pertenencia,rol FROM convivencia_mensajeria.pertenencia "
                "WHERE id_arriendo=%s AND id_usuario=%s AND estado='Activa' FOR UPDATE",
                (rental_id, target_id),
            )
            if target is None:
                raise RuleViolation("Integrante activo no encontrado.", 404)
            self.query(
                "UPDATE convivencia_mensajeria.pertenencia SET estado='Retirada',"
                "salida_en=clock_timestamp(),id_retirado_por=%s,motivo_retiro=%s "
                "WHERE id_pertenencia=%s RETURNING id_pertenencia",
                (actor_id, reason, target["id_pertenencia"]),
            )
            self.query(
                "UPDATE convivencia_mensajeria.tarea SET id_asignado=NULL "
                "WHERE id_arriendo=%s AND id_asignado=%s AND estado='Pendiente' "
                "RETURNING id_tarea",
                (rental_id, target_id),
            )
            if target["rol"] == "Responsable":
                self.query(
                    "UPDATE convivencia_mensajeria.arriendo SET id_responsable=NULL "
                    "WHERE id_arriendo=%s RETURNING id_arriendo",
                    (rental_id,),
                )
            occupied = self.query(
                "SELECT count(*) AS total FROM convivencia_mensajeria.pertenencia "
                "WHERE id_arriendo=%s AND estado='Activa'",
                (rental_id,),
            )["total"]
            state = "Finalizado" if occupied == 0 else "Activo"
            version = rental["version_ocupacion"] + 1
            self.query(
                "UPDATE convivencia_mensajeria.arriendo SET estado=%s,"
                "version_ocupacion=%s,finalizado_en=CASE WHEN %s='Finalizado' "
                "THEN clock_timestamp() ELSE NULL END WHERE id_arriendo=%s "
                "RETURNING id_arriendo",
                (state, version, state, rental_id),
            )
            self.query(
                "INSERT INTO convivencia_mensajeria.expulsion "
                "(id_arriendo,id_usuario,id_actor,motivo,clave) VALUES (%s,%s,%s,%s,%s)",
                (rental_id, target_id, actor_id, reason, key),
            )
            response = {
                "id_arriendo": rental_id,
                "id_usuario": target_id,
                "estado_pertenencia": "Retirada",
                "estado_arriendo": state,
                "cupos_ocupados": occupied,
                "cupos_totales": rental["capacidad"],
                "version_ocupacion": version,
            }
            payload = {
                "event_key": f"ocupacion:{rental['id_publicacion']}:{version}",
                "id_publicacion": rental["id_publicacion"],
                "id_usuario": target_id,
                "version_ocupacion": version,
                "cupos_totales": rental["capacidad"],
                "cupos_ocupados": occupied,
                "estado": "Cerrada" if state == "Finalizado" else "Activa",
            }
            self._enqueue(f"ocupacion:{rental['id_publicacion']}:{version}", payload)
            self.query(
                "INSERT INTO convivencia_mensajeria.comando "
                "(clave,huella,respuesta) VALUES (%s,%s,%s)",
                (key, fingerprint, json.dumps(response)),
            )
            return response

    def historical_relation(self, user_a, user_b):
        return self.query(
            "SELECT 1 FROM convivencia_mensajeria.pertenencia a "
            "JOIN convivencia_mensajeria.pertenencia b USING(id_arriendo) "
            "WHERE a.id_usuario=%s AND b.id_usuario=%s LIMIT 1",
            (user_a, user_b),
        ) is not None

    def claim_outbox(self, limit):
        return self.query(
            "WITH selected AS ("
            " SELECT id_evento FROM convivencia_mensajeria.outbox "
            " WHERE entregado_en IS NULL AND reintentar_en<=clock_timestamp() "
            " AND (reclamado_hasta IS NULL OR reclamado_hasta<clock_timestamp()) "
            " ORDER BY id_evento LIMIT %s FOR UPDATE SKIP LOCKED"
            ") UPDATE convivencia_mensajeria.outbox o SET "
            "reclamado_hasta=clock_timestamp()+interval '30 seconds',"
            "intentos=o.intentos+1 FROM selected "
            "WHERE o.id_evento=selected.id_evento "
            "RETURNING o.id_evento,o.intentos,o.clave,o.payload",
            (limit,),
            many=True,
        )

    def delivered(self, event_id):
        self.query(
            "UPDATE convivencia_mensajeria.outbox SET entregado_en=clock_timestamp(),"
            "reclamado_hasta=NULL,error=NULL WHERE id_evento=%s RETURNING id_evento",
            (event_id,),
        )

    def retry_outbox(self, event_id, attempts):
        delay = min(2 ** min(attempts, 8), 300)
        self.query(
            "UPDATE convivencia_mensajeria.outbox SET reclamado_hasta=NULL,"
            "reintentar_en=clock_timestamp()+(%s * interval '1 second'),"
            "error='dependencia_no_disponible' WHERE id_evento=%s "
            "RETURNING id_evento",
            (delay, event_id),
        )
