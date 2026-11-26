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
            row = c.execute("""SELECT a.id_arriendo,a.id_publicacion,a.cupos_totales,a.version_capacidad,a.estado,
                (SELECT count(*) FROM convivencia_mensajeria.pertenencia p WHERE p.id_arriendo=a.id_arriendo AND p.estado='Activa') AS ocupacion
                ,(SELECT CASE WHEN p.estado='Activa' THEN p.id_usuario ELSE NULL END FROM convivencia_mensajeria.pertenencia p WHERE p.id_arriendo=a.id_arriendo ORDER BY p.id_pertenencia LIMIT 1) AS id_responsable
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
            _, membership = self._authorize_conversation(c, conversation_id, user_id, lock=True)
            query = """SELECT id_mensaje,id_conversacion,id_emisor AS id_remitente,nombre_remitente,contenido,id_cliente,fecha_envio
                FROM convivencia_mensajeria.mensajes
                WHERE id_conversacion=%s AND fecha_envio >= %s"""
            params = [conversation_id, membership["creada_en"]]
            if before_id is not None:
                anchor = c.execute("""SELECT fecha_envio,id_mensaje FROM convivencia_mensajeria.mensajes
                    WHERE id_conversacion=%s AND id_mensaje=%s AND fecha_envio >= %s""",
                    (conversation_id, before_id, membership["creada_en"])).fetchone()
                if anchor is None:
                    raise ServiceError("INVALID_CURSOR", "Cursor inválido.", 422)
                query += " AND (fecha_envio,id_mensaje) < (%s,%s)"
                params.extend([anchor["fecha_envio"], anchor["id_mensaje"]])
            query += " ORDER BY fecha_envio DESC,id_mensaje DESC LIMIT %s"
            params.append(limit + 1)
            rows = c.execute(query, params).fetchall()
            has_older = len(rows) > limit
            page = list(reversed(rows[:limit]))
            next_before = page[0]["id_mensaje"] if has_older and page else None
            return page, next_before

    def send_message(self, conversation_id, user_id, display_name, content, client_id):
        with self.transaction() as c:
            self._authorize_conversation(c, conversation_id, user_id, lock=True)
            row = c.execute("""INSERT INTO convivencia_mensajeria.mensajes
                (id_conversacion,id_emisor,nombre_remitente,contenido,id_cliente)
                VALUES(%s,%s,%s,%s,%s)
                ON CONFLICT(id_conversacion,id_emisor,id_cliente) DO NOTHING
                RETURNING id_mensaje,id_conversacion,id_emisor AS id_remitente,nombre_remitente,contenido,id_cliente,fecha_envio""",
                (conversation_id, user_id, display_name, content, client_id)).fetchone()
            if row is not None:
                return row
            row = c.execute("""SELECT id_mensaje,id_conversacion,id_emisor AS id_remitente,nombre_remitente,contenido,id_cliente,fecha_envio
                FROM convivencia_mensajeria.mensajes
                WHERE id_conversacion=%s AND id_emisor=%s AND id_cliente=%s""",
                (conversation_id, user_id, client_id)).fetchone()
            if row is None:
                raise ServiceError("MESSAGE_RETRY_CONFLICT", "No se pudo confirmar el reintento.", 409)
            if row["contenido"] != content:
                raise ServiceError("MESSAGE_IDEMPOTENCY_CONFLICT", "El UUID ya fue usado con otro contenido.", 409)
            return row

    @staticmethod
    def _active_member(c, rental_id, user_id):
        rental = c.execute("SELECT id_arriendo FROM convivencia_mensajeria.arriendo WHERE id_arriendo=%s", (rental_id,)).fetchone()
        if rental is None:
            raise ServiceError("RENTAL_NOT_FOUND", "Arriendo no encontrado.", 404)
        member = c.execute("""SELECT id_usuario FROM convivencia_mensajeria.pertenencia
            WHERE id_arriendo=%s AND id_usuario=%s AND estado='Activa' FOR SHARE""", (rental_id, user_id)).fetchone()
        if member is None:
            raise ServiceError("TASK_FORBIDDEN", "No perteneces a este arriendo.", 403)

    @staticmethod
    def _task(c, task_id):
        task = c.execute("""SELECT id_tarea,id_arriendo,titulo,descripcion,estado,id_creador,id_asignado,fecha_creacion
            FROM convivencia_mensajeria.tarea WHERE id_tarea=%s FOR UPDATE""", (task_id,)).fetchone()
        if task is None:
            raise ServiceError("TASK_NOT_FOUND", "Tarea no encontrada.", 404)
        return task

    def task_rental(self, task_id):
        with self.transaction() as c:
            row = c.execute("SELECT id_arriendo FROM convivencia_mensajeria.tarea WHERE id_tarea=%s", (task_id,)).fetchone()
            if row is None:
                raise ServiceError("TASK_NOT_FOUND", "Tarea no encontrada.", 404)
            return row["id_arriendo"]

    def _active_member_check(self, rental_id, user_id):
        with self.transaction() as c:
            self._active_member(c, rental_id, user_id)

    def active_members(self, rental_id, user_id, after_id, limit):
        with self.transaction() as c:
            self._active_member(c, rental_id, user_id)
            rows = c.execute("""SELECT id_usuario,creada_en AS fecha_ingreso
                FROM convivencia_mensajeria.pertenencia
                WHERE id_arriendo=%s AND estado='Activa' AND id_usuario>%s
                ORDER BY id_usuario LIMIT %s""", (rental_id, after_id, limit + 1)).fetchall()
            return rows[:limit], rows[limit - 1]["id_usuario"] if len(rows) > limit else None

    def list_tasks(self, rental_id, user_id, state, before_id, limit, assigned=None):
        with self.transaction() as c:
            self._active_member(c, rental_id, user_id)
            params = [rental_id, state, state, assigned, assigned]
            before = ""
            if before_id is not None:
                before = " AND id_tarea < %s"
                params.append(before_id)
            params.append(limit + 1)
            rows = c.execute("""SELECT id_tarea,id_arriendo,titulo,descripcion,estado,id_creador,id_asignado,fecha_creacion
                FROM convivencia_mensajeria.tarea WHERE id_arriendo=%s AND (%s::text IS NULL OR estado=%s)
                AND (%s::bigint IS NULL OR id_asignado=%s)""" + before +
                " ORDER BY id_tarea DESC LIMIT %s", params).fetchall()
            page = rows[:limit]
            return page, page[-1]["id_tarea"] if len(rows) > limit else None

    def create_task(self, rental_id, user_id, title, description, assignee):
        with self.transaction() as c:
            self._active_member(c, rental_id, user_id)
            if assignee is not None:
                self._validate_assignee(c, rental_id, assignee)
            return c.execute("""INSERT INTO convivencia_mensajeria.tarea
                (id_arriendo,titulo,descripcion,id_creador,id_asignado) VALUES(%s,%s,%s,%s,%s)
                RETURNING id_tarea,id_arriendo,titulo,descripcion,estado,id_creador,id_asignado,fecha_creacion""",
                (rental_id, title, description, user_id, assignee)).fetchone()

    @staticmethod
    def _validate_assignee(c, rental_id, assignee):
        member = c.execute("""SELECT id_usuario FROM convivencia_mensajeria.pertenencia
            WHERE id_arriendo=%s AND id_usuario=%s AND estado='Activa' FOR SHARE""", (rental_id, assignee)).fetchone()
        if member is None:
            raise ServiceError("INVALID_ASSIGNEE", "El asignado debe ser un integrante activo.", 422)

    def reassign_task(self, task_id, user_id, assignee):
        rental_id = self.task_rental(task_id)
        with self.transaction() as c:
            self._active_member(c, rental_id, user_id)
            if assignee is not None:
                self._validate_assignee(c, rental_id, assignee)
            task = self._task(c, task_id)
            if task["estado"] != "Pendiente":
                raise ServiceError("TASK_NOT_PENDING", "Solo se reasignan tareas pendientes.", 409)
            return c.execute("""UPDATE convivencia_mensajeria.tarea SET id_asignado=%s WHERE id_tarea=%s
                RETURNING id_tarea,id_arriendo,titulo,descripcion,estado,id_creador,id_asignado,fecha_creacion""",
                (assignee, task_id)).fetchone()

    def complete_task(self, task_id, user_id):
        rental_id = self.task_rental(task_id)
        with self.transaction() as c:
            self._active_member(c, rental_id, user_id)
            task = self._task(c, task_id)
            if task["id_asignado"] != user_id:
                raise ServiceError("TASK_FORBIDDEN", "Solo el asignado puede completar la tarea.", 403)
            if task["estado"] != "Pendiente":
                raise ServiceError("TASK_NOT_PENDING", "La tarea ya no está pendiente.", 422)
            return c.execute("""UPDATE convivencia_mensajeria.tarea
                SET estado='Completada',fecha_completada=clock_timestamp() WHERE id_tarea=%s
                RETURNING id_tarea,id_arriendo,titulo,descripcion,estado,id_creador,id_asignado,fecha_creacion""",
                (task_id,)).fetchone()

    def rental_publication(self, rental_id):
        with self.transaction() as c:
            row = c.execute("SELECT id_publicacion FROM convivencia_mensajeria.arriendo WHERE id_arriendo=%s", (rental_id,)).fetchone()
            if row is None:
                raise ServiceError("RENTAL_NOT_FOUND", "Arriendo no encontrado.", 404)
            return row["id_publicacion"]

    def members(self, rental_id, user_id, owner=False, after=0, limit=20):
        with self.transaction() as c:
            if not owner and not c.execute("SELECT 1 FROM convivencia_mensajeria.pertenencia WHERE id_arriendo=%s AND id_usuario=%s AND estado='Activa'", (rental_id, user_id)).fetchone():
                raise ServiceError("FORBIDDEN", "No tienes acceso al arriendo.", 403)
            return c.execute("""SELECT id_pertenencia,id_usuario,creada_en AS fecha_ingreso,
                estado='Activa' AS activo,
                id_pertenencia=(SELECT min(first.id_pertenencia) FROM convivencia_mensajeria.pertenencia first WHERE first.id_arriendo=%s) AS es_responsable FROM convivencia_mensajeria.pertenencia
                WHERE id_arriendo=%s AND id_pertenencia>%s AND estado='Activa'
                ORDER BY id_pertenencia LIMIT %s""", (rental_id, rental_id, after, limit + 1)).fetchall()
