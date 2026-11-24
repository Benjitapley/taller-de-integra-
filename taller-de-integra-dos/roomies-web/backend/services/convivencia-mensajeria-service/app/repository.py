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

    def conversations(self, user_id):
        with self.transaction() as c:
            return c.execute("""SELECT c.id_conversacion,c.id_arriendo,c.creada_en AS fecha_creacion
                FROM convivencia_mensajeria.conversacion c
                JOIN convivencia_mensajeria.pertenencia p USING(id_arriendo)
                WHERE p.id_usuario=%s AND p.estado='Activa'
                ORDER BY c.id_conversacion""", (user_id,)).fetchall()

    @staticmethod
    def _authorize_conversation(c, conversation_id, user_id, *, lock=False):
        conversation = c.execute("""SELECT id_conversacion,id_arriendo,creada_en AS fecha_creacion
            FROM convivencia_mensajeria.conversacion WHERE id_conversacion=%s""", (conversation_id,)).fetchone()
        if conversation is None:
            raise ServiceError("CONVERSATION_NOT_FOUND", "Conversación no encontrada.", 404)
        suffix = " FOR SHARE" if lock else ""
        membership = c.execute("""SELECT creada_en FROM convivencia_mensajeria.pertenencia
            WHERE id_arriendo=%s AND id_usuario=%s AND estado='Activa'""" + suffix,
            (conversation["id_arriendo"], user_id)).fetchone()
        if membership is None:
            raise ServiceError("CONVERSATION_FORBIDDEN", "No tienes acceso a esta conversación.", 403)
        return conversation, membership

    def conversation(self, conversation_id, user_id):
        with self.transaction() as c:
            conversation, _ = self._authorize_conversation(c, conversation_id, user_id)
            return conversation

    def messages(self, conversation_id, user_id, before_id, limit):
        with self.transaction() as c:
            _, membership = self._authorize_conversation(c, conversation_id, user_id)
            query = """SELECT id_mensaje,id_conversacion,id_remitente,nombre_remitente,contenido,id_cliente,fecha_envio
                FROM convivencia_mensajeria.mensaje
                WHERE id_conversacion=%s AND fecha_envio >= %s"""
            params = [conversation_id, membership["creada_en"]]
            if before_id is not None:
                query += " AND id_mensaje < %s"
                params.append(before_id)
            query += " ORDER BY id_mensaje DESC LIMIT %s"
            params.append(limit + 1)
            rows = c.execute(query, params).fetchall()
            has_older = len(rows) > limit
            page = list(reversed(rows[:limit]))
            next_before = page[0]["id_mensaje"] if has_older and page else None
            return page, next_before

    def send_message(self, conversation_id, user_id, display_name, content, client_id):
        with self.transaction() as c:
            self._authorize_conversation(c, conversation_id, user_id, lock=True)
            row = c.execute("""INSERT INTO convivencia_mensajeria.mensaje
                (id_conversacion,id_remitente,nombre_remitente,contenido,id_cliente)
                VALUES(%s,%s,%s,%s,%s)
                ON CONFLICT(id_conversacion,id_remitente,id_cliente) DO NOTHING
                RETURNING id_mensaje,id_conversacion,id_remitente,nombre_remitente,contenido,id_cliente,fecha_envio""",
                (conversation_id, user_id, display_name, content, client_id)).fetchone()
            if row is not None:
                return row
            row = c.execute("""SELECT id_mensaje,id_conversacion,id_remitente,nombre_remitente,contenido,id_cliente,fecha_envio
                FROM convivencia_mensajeria.mensaje
                WHERE id_conversacion=%s AND id_remitente=%s AND id_cliente=%s""",
                (conversation_id, user_id, client_id)).fetchone()
            if row is None:
                raise ServiceError("MESSAGE_RETRY_CONFLICT", "No se pudo confirmar el reintento.", 409)
            if row["contenido"] != content:
                raise ServiceError("MESSAGE_IDEMPOTENCY_CONFLICT", "El UUID ya fue usado con otro contenido.", 409)
            return row
