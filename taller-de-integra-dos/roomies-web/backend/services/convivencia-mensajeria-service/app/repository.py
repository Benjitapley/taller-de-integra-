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

    def get(self, rental_id, user_id, access_checked=False):
        with self.transaction() as c:
            row = c.execute("""SELECT a.id_arriendo,a.id_publicacion,a.cupos_totales,a.version_capacidad,%s AS es_dueno,
                (SELECT count(*) FROM convivencia_mensajeria.pertenencia p WHERE p.id_arriendo=a.id_arriendo AND p.estado='Activa') AS ocupacion
                FROM convivencia_mensajeria.arriendo a
                WHERE a.id_arriendo=%s AND (%s OR EXISTS (SELECT 1 FROM convivencia_mensajeria.pertenencia p
                  WHERE p.id_arriendo=a.id_arriendo AND p.id_usuario=%s AND p.estado='Activa'))""", (access_checked, rental_id, access_checked, user_id)).fetchone()
            if row is None:
                raise ServiceError("RENTAL_NOT_FOUND", "Arriendo no encontrado.", 404)
            return row

    def mine(self, user_id):
        with self.transaction() as c:
            row = c.execute("SELECT id_arriendo FROM convivencia_mensajeria.pertenencia WHERE id_usuario=%s AND estado='Activa'", (user_id,)).fetchone()
            if row is None:
                raise ServiceError("RENTAL_NOT_FOUND", "Arriendo no encontrado.", 404)
        return self.get(row["id_arriendo"], user_id)

    def publication(self, rental_id):
        with self.transaction() as c:
            row = c.execute("SELECT id_publicacion FROM convivencia_mensajeria.arriendo WHERE id_arriendo=%s", (rental_id,)).fetchone()
            if row is None:
                raise ServiceError("RENTAL_NOT_FOUND", "Arriendo no encontrado.", 404)
            return row["id_publicacion"]

    def rental_for_publication(self, publication_id):
        with self.transaction() as c:
            row = c.execute("SELECT id_arriendo FROM convivencia_mensajeria.arriendo WHERE id_publicacion=%s", (publication_id,)).fetchone()
            if row is None:
                raise ServiceError("RENTAL_NOT_FOUND", "Arriendo no encontrado.", 404)
            return row["id_arriendo"]

    def members(self, rental_id, user_id, active_only=True, access_checked=False, limit=20, before=None):
        with self.transaction() as c:
            rental = c.execute("SELECT id_arriendo FROM convivencia_mensajeria.arriendo WHERE id_arriendo=%s", (rental_id,)).fetchone()
            if rental is None:
                raise ServiceError("RENTAL_NOT_FOUND", "Arriendo no encontrado.", 404)
            if not access_checked:
                allowed = c.execute("""SELECT 1 FROM convivencia_mensajeria.pertenencia
                    WHERE id_arriendo=%s AND id_usuario=%s AND estado='Activa'""", (rental_id, user_id)).fetchone()
                if allowed is None:
                    raise ServiceError("FORBIDDEN", "No tienes acceso a los integrantes.", 403)
            where = "AND p.estado='Activa'" if active_only else ""
            boundary = "AND (p.creada_en,p.id_pertenencia)>(%s,%s)" if before else ""
            rows = c.execute(f"""SELECT p.id_usuario,p.creada_en,p.id_pertenencia,
                CASE WHEN p.id_pertenencia=(SELECT min(p2.id_pertenencia) FROM convivencia_mensajeria.pertenencia p2
                  WHERE p2.id_arriendo=p.id_arriendo AND p2.estado='Activa') THEN true ELSE false END AS es_responsable
                FROM convivencia_mensajeria.pertenencia p
                WHERE p.id_arriendo=%s {where} {boundary}
                ORDER BY p.creada_en ASC,p.id_pertenencia ASC LIMIT %s""", (rental_id, *(before or ()), limit)).fetchall()
            items = [{"id_usuario": row["id_usuario"],
                      "fecha_ingreso": row["creada_en"].isoformat().replace("+00:00", "Z"),
                      "fecha_salida": None,
                      "es_responsable": row["es_responsable"]} for row in rows]
            return {"items": items, "rows": rows}

    def expel(self, rental_id, actor_id, payload):
        with self.transaction() as c:
            target = c.execute("""SELECT p.* FROM convivencia_mensajeria.pertenencia p
                WHERE p.id_arriendo=%s AND p.id_usuario=%s AND p.estado='Activa'
                FOR UPDATE""", (rental_id, payload["id_usuario"])).fetchone()
            if target is None:
                repeated = c.execute("""SELECT 1 FROM convivencia_mensajeria.pertenencia
                    WHERE id_arriendo=%s AND id_usuario=%s""", (rental_id, payload["id_usuario"])).fetchone()
                if repeated is None:
                    raise ServiceError("MEMBER_NOT_ACTIVE", "El integrante no pertenece al arriendo.", 409)
                return {"id_arriendo": rental_id, "id_usuario": payload["id_usuario"], "retirado": True}
            c.execute("""UPDATE convivencia_mensajeria.pertenencia
                SET estado='Inactiva',terminada_en=clock_timestamp()
                WHERE id_pertenencia=%s""", (target["id_pertenencia"],))
            c.execute("""INSERT INTO convivencia_mensajeria.expulsion
                (id_arriendo,id_pertenencia,id_usuario,id_ejecutor,motivo)
                VALUES (%s,%s,%s,%s,%s)
                ON CONFLICT DO NOTHING""",
                (rental_id, target["id_pertenencia"], payload["id_usuario"], actor_id, payload["motivo"]))
            return {"id_arriendo": rental_id, "id_usuario": payload["id_usuario"], "retirado": True}

    def overlapped(self, a, b):
        with self.transaction() as c:
            return c.execute("""SELECT EXISTS (
                SELECT FROM convivencia_mensajeria.pertenencia a
                JOIN convivencia_mensajeria.pertenencia b USING(id_arriendo)
                WHERE a.id_usuario=%s AND b.id_usuario=%s AND a.id_usuario<>b.id_usuario
                  AND (a.estado='Activa' OR a.terminada_en>a.creada_en)
                  AND (b.estado='Activa' OR b.terminada_en>b.creada_en)
                  AND a.creada_en<COALESCE(b.terminada_en,'infinity'::timestamptz)
                  AND b.creada_en<COALESCE(a.terminada_en,'infinity'::timestamptz)
            ) AS coincidio""", (a, b)).fetchone()["coincidio"]
