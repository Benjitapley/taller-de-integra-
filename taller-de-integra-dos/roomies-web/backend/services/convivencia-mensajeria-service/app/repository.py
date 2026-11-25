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

    def get(self, rental_id, user_id, owner=False):
        with self.transaction() as c:
            row = c.execute("""SELECT a.id_arriendo,a.id_publicacion,a.cupos_totales,a.version_capacidad,
                (SELECT count(*) FROM convivencia_mensajeria.pertenencia p WHERE p.id_arriendo=a.id_arriendo AND p.estado='Activa') AS ocupacion
                FROM convivencia_mensajeria.arriendo a
                WHERE a.id_arriendo=%s AND (%s OR EXISTS (SELECT 1 FROM convivencia_mensajeria.pertenencia p
                  WHERE p.id_arriendo=a.id_arriendo AND p.id_usuario=%s AND p.estado='Activa'))""", (rental_id, owner, user_id)).fetchone()
            if row is None:
                raise ServiceError("RENTAL_NOT_FOUND", "Arriendo no encontrado.", 404)
            return row

    def mine(self, user_id):
        with self.transaction() as c:
            row = c.execute("SELECT id_arriendo FROM convivencia_mensajeria.pertenencia WHERE id_usuario=%s AND estado='Activa'", (user_id,)).fetchone()
            if row is None:
                raise ServiceError("RENTAL_NOT_FOUND", "Arriendo no encontrado.", 404)
        return self.get(row["id_arriendo"], user_id)

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

    def rental_publication(self, rental_id):
        with self.transaction() as c:
            row = c.execute("SELECT id_publicacion FROM convivencia_mensajeria.arriendo WHERE id_arriendo=%s", (rental_id,)).fetchone()
            if row is None:
                raise ServiceError("RENTAL_NOT_FOUND", "Arriendo no encontrado.", 404)
            return row["id_publicacion"]

    def members(self, rental_id, user_id, owner, after, limit):
        with self.transaction() as c:
            if not owner and not c.execute("SELECT 1 FROM convivencia_mensajeria.pertenencia WHERE id_arriendo=%s AND id_usuario=%s AND estado='Activa'", (rental_id, user_id)).fetchone():
                raise ServiceError("FORBIDDEN", "No tienes acceso al arriendo.", 403)
            return c.execute("""SELECT id_pertenencia,id_usuario,creada_en AS fecha_ingreso,
                estado='Activa' AS activo,
                id_pertenencia=(SELECT min(first.id_pertenencia) FROM convivencia_mensajeria.pertenencia first WHERE first.id_arriendo=%s) AS es_responsable FROM convivencia_mensajeria.pertenencia
                WHERE id_arriendo=%s AND id_pertenencia>%s AND estado='Activa'
                ORDER BY id_pertenencia LIMIT %s""", (rental_id, rental_id, after, limit + 1)).fetchall()
