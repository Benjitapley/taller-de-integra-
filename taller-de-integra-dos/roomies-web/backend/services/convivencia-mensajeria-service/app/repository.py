"""Persistencia propia; no hay joins, claves foráneas ni SQL de otros dominios."""
from contextlib import contextmanager

import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb

from backend.service_runtime.settings import database_url
from app.models import ServiceError


class PostgresRepository:
    def __init__(self, connection_factory=None):
        self.connection_factory = connection_factory

    def connect(self):
        if self.connection_factory:
            return self.connection_factory()
        return psycopg.connect(database_url("CONVIVENCIA_DATABASE_URL", "sql_convivencia_mensajeria"), row_factory=dict_row, connect_timeout=3, prepare_threshold=None)

    @contextmanager
    def transaction(self):
        with self.connect() as connection:
            yield connection

    def begin(self, key, payload):
        with self.transaction() as c:
            c.execute("INSERT INTO convivencia_mensajeria.incorporacion(id_operacion,payload) VALUES(%s,%s) ON CONFLICT DO NOTHING", (key, Jsonb(payload)))

    def pending(self):
        with self.transaction() as c:
            return c.execute("""WITH picked AS (
                SELECT id_operacion FROM convivencia_mensajeria.incorporacion WHERE estado='Pendiente'
                ORDER BY ultimo_intento NULLS FIRST,creada_en LIMIT 20 FOR UPDATE SKIP LOCKED)
                UPDATE convivencia_mensajeria.incorporacion i SET ultimo_intento=clock_timestamp()
                FROM picked p WHERE i.id_operacion=p.id_operacion RETURNING i.id_operacion,i.payload""").fetchall()

    def get(self, rental_id, user_id):
        with self.transaction() as c:
            row = c.execute("""SELECT a.id_arriendo,a.id_publicacion,a.cupos_totales,a.version_capacidad,
                (SELECT count(*) FROM convivencia_mensajeria.pertenencia p WHERE p.id_arriendo=a.id_arriendo AND p.estado='Activa') AS ocupacion
                FROM convivencia_mensajeria.arriendo a
                WHERE a.id_arriendo=%s AND EXISTS (SELECT 1 FROM convivencia_mensajeria.pertenencia p
                  WHERE p.id_arriendo=a.id_arriendo AND p.id_usuario=%s AND p.estado='Activa')""", (rental_id, user_id)).fetchone()
            if row is None:
                raise ServiceError("RENTAL_NOT_FOUND", "Arriendo no encontrado.", 404)
            return row

    def mine(self, user_id):
        with self.transaction() as c:
            row = c.execute("SELECT id_arriendo FROM convivencia_mensajeria.pertenencia WHERE id_usuario=%s AND estado='Activa'", (user_id,)).fetchone()
            if row is None:
                raise ServiceError("RENTAL_NOT_FOUND", "Arriendo no encontrado.", 404)
        return self.get(row["id_arriendo"], user_id)

    def expel(self, rental_id, actor_id, target_id, reason, key, publications):
        with self.transaction() as c:
            expulsion = c.execute(
                "SELECT * FROM convivencia_mensajeria.expulsion WHERE clave=%s",
                (key,),
            ).fetchone()
            if expulsion is not None:
                if (
                    expulsion["id_arriendo"] != rental_id
                    or expulsion["id_usuario"] != target_id
                    or expulsion["id_actor"] != actor_id
                    or expulsion["motivo"] != reason
                ):
                    raise ServiceError(
                        "IDEMPOTENCY_CONFLICT",
                        "La clave ya fue usada con otros datos.",
                        409,
                    )
                rental = c.execute(
                    "SELECT id_arriendo,id_publicacion,cupos_totales,version_capacidad,estado "
                    "FROM convivencia_mensajeria.arriendo WHERE id_arriendo=%s",
                    (rental_id,),
                ).fetchone()
                remaining = c.execute(
                    "SELECT count(*) AS total FROM convivencia_mensajeria.pertenencia "
                    "WHERE id_arriendo=%s AND estado='Activa'",
                    (rental_id,),
                ).fetchone()["total"] if rental else 0
                body = {
                    "id_arriendo": rental_id,
                    "id_usuario": expulsion["id_usuario"],
                    "estado_pertenencia": "Inactiva",
                    "cupos_ocupados": remaining,
                }
                return 201, body, True

            rental = c.execute(
                "SELECT * FROM convivencia_mensajeria.arriendo "
                "WHERE id_arriendo=%s FOR UPDATE",
                (rental_id,),
            ).fetchone()
            if rental is None or rental["estado"] != "Activo":
                raise ServiceError("RENTAL_NOT_FOUND", "Arriendo no encontrado.", 404)
            if rental["id_arrendador"] != actor_id:
                raise ServiceError(
                    "FORBIDDEN_OWNER",
                    "Solo el dueño de la publicación puede retirar integrantes.",
                    403,
                )
            target = c.execute(
                "SELECT id_pertenencia,rol FROM convivencia_mensajeria.pertenencia "
                "WHERE id_arriendo=%s AND id_usuario=%s AND estado='Activa'",
                (rental_id, target_id),
            ).fetchone()
            if target is None:
                raise ServiceError("MEMBER_NOT_ACTIVE", "El integrante no está activo.", 404)

            c.execute(
                "UPDATE convivencia_mensajeria.pertenencia "
                "SET estado='Inactiva',salida_en=clock_timestamp(),"
                "id_retirado_por=%s,motivo_retiro=%s "
                "WHERE id_pertenencia=%s",
                (actor_id, reason, target["id_pertenencia"]),
            )
            c.execute(
                "UPDATE convivencia_mensajeria.tarea SET id_asignado=NULL "
                "WHERE id_arriendo=%s AND id_asignado=%s AND estado='Pendiente'",
                (rental_id, target_id),
            )
            if target["rol"] == "Responsable":
                c.execute(
                    "UPDATE convivencia_mensajeria.arriendo "
                    "SET id_responsable=NULL WHERE id_arriendo=%s",
                    (rental_id,),
                )

            remaining = c.execute(
                "SELECT count(*) AS total FROM convivencia_mensajeria.pertenencia "
                "WHERE id_arriendo=%s AND estado='Activa'",
                (rental_id,),
            ).fetchone()["total"]
            version = rental["version_ocupacion"] + 1
            c.execute(
                "UPDATE convivencia_mensajeria.arriendo "
                "SET version_ocupacion=%s WHERE id_arriendo=%s",
                (version, rental_id),
            )
            c.execute(
                "INSERT INTO convivencia_mensajeria.expulsion "
                "(clave,id_arriendo,id_usuario,id_actor,motivo) "
                "VALUES(%s,%s,%s,%s,%s)",
                (key, rental_id, target_id, actor_id, reason),
            )

            payload = {
                "id_publicacion": rental["id_publicacion"],
                "cupos_ocupados": remaining,
                "version_ocupacion": version,
            }
            c.execute(
                "INSERT INTO convivencia_mensajeria.outbox "
                "(id_operacion,accion,reserva) VALUES(%s,%s,%s) "
                "ON CONFLICT(id_operacion,accion) DO NOTHING",
                (key, "Retiro", Jsonb(payload)),
            )

            if remaining == 0:
                c.execute(
                    "UPDATE convivencia_mensajeria.arriendo "
                    "SET estado='Finalizado' WHERE id_arriendo=%s",
                    (rental_id,),
                )
                c.execute(
                    "INSERT INTO convivencia_mensajeria.outbox "
                    "(id_operacion,accion,reserva) VALUES(%s,%s,%s)",
                    (
                        key,
                        "Cierre",
                        Jsonb({
                            "id_publicacion": rental["id_publicacion"],
                            "cupos_ocupados": 0,
                            "version_ocupacion": version,
                        }),
                    ),
                )

            body = {
                "id_arriendo": rental_id,
                "id_usuario": target_id,
                "estado_pertenencia": "Inactiva",
                "cupos_ocupados": remaining,
                "version_ocupacion": version,
            }
            return 201, body, False
