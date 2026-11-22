import psycopg
import json
from psycopg.rows import dict_row

from backend.service_runtime.settings import database_url
from backend.service_runtime.contracts import RuleViolation


FIELDS = "id_reporte,tipo,id_usuario_reportado,id_publicacion_reportada,categoria,descripcion,estado,fecha"
DETAIL = f"""
    SELECT {FIELDS},id_denunciante,COALESCE((
        SELECT jsonb_agg(jsonb_build_object(
            'id_actuacion', h.id_actuacion, 'id_administrador', h.id_administrador,
            'estado_anterior', h.estado_anterior, 'estado_nuevo', h.estado_nuevo,
            'nota_interna', h.nota_interna, 'fecha', h.fecha
        ) ORDER BY h.id_actuacion)
        FROM reportes.reporte_historial h WHERE h.id_reporte = r.id_reporte
    ),'[]'::jsonb) AS historial
    FROM reportes.reporte r WHERE r.id_reporte=%s
"""


class ReportRepository:
    def connect(self):
        return psycopg.connect(
            database_url("REPORTES_DATABASE_URL", "sql_reportes"),
            row_factory=dict_row, connect_timeout=3, prepare_threshold=None,
        )

    def operation(self, actor_id, key, fingerprint, connection=None):
        if connection is None:
            with self.connect() as active:
                return self.operation(actor_id, key, fingerprint, active)
        row = connection.execute("SELECT huella,respuesta FROM reportes.operacion_envio WHERE id_denunciante=%s AND clave=%s", (actor_id, key)).fetchone()
        if row is None:
            return None
        if row["huella"] != fingerprint:
            raise RuleViolation("La clave de envío ya corresponde a otro contenido.", 409)
        return row["respuesta"]

    def create(self, actor_id, data, operation=None, fingerprint=None):
        with self.connect() as connection:
            if operation is not None:
                connection.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s,0))", (f"reporte:{actor_id}:{operation}",))
                previous = self.operation(actor_id, operation, fingerprint, connection)
                if previous is not None:
                    return previous
            report = connection.execute(
                f"""INSERT INTO reportes.reporte
                    (id_denunciante,id_usuario_reportado,id_publicacion_reportada,categoria,descripcion)
                    VALUES (%s,%s,%s,%s,%s) RETURNING {FIELDS}""",
                (actor_id, data.id_usuario_reportado, data.id_publicacion_reportada, data.categoria, data.descripcion),
            ).fetchone()
            if operation is not None:
                connection.execute("INSERT INTO reportes.operacion_envio(id_denunciante,clave,huella,respuesta) VALUES(%s,%s,%s,%s)",
                                   (actor_id,operation,fingerprint,json.dumps(report,default=lambda value:value.isoformat())))
            return report

    def mine(self, actor_id, limit, before):
        boundary = " AND (fecha,id_reporte)<(%s,%s)" if before else ""
        with self.connect() as connection:
            return connection.execute(
                f"""SELECT {FIELDS} FROM reportes.reporte WHERE id_denunciante=%s{boundary}
                    ORDER BY fecha DESC,id_reporte DESC LIMIT %s""",
                (actor_id, *(before or ()), limit),
            ).fetchall()

    def moderation_queue(self, status, kind, limit, before):
        conditions, args = [], []
        if status is not None:
            conditions.append("estado=%s")
            args.append(status)
        if kind is not None:
            conditions.append("tipo=%s")
            args.append(kind)
        if before is not None:
            conditions.append("(fecha,id_reporte)<(%s,%s)")
            args.extend(before)
        where = " WHERE " + " AND ".join(conditions) if conditions else ""
        with self.connect() as connection:
            return connection.execute(
                f"""SELECT {FIELDS},id_denunciante FROM reportes.reporte{where}
                    ORDER BY fecha DESC,id_reporte DESC LIMIT %s""",
                (*args, limit),
            ).fetchall()

    def detail(self, report_id):
        with self.connect() as connection:
            return connection.execute(DETAIL, (report_id,)).fetchone()

    def review(self, report_id, administrator_id, data, transitions):
        with self.connect() as connection:
            current = connection.execute(
                "SELECT estado FROM reportes.reporte WHERE id_reporte=%s FOR UPDATE", (report_id,),
            ).fetchone()
            if current is None:
                return None
            previous = current["estado"]
            transitions(previous, data.estado)
            connection.execute("UPDATE reportes.reporte SET estado=%s WHERE id_reporte=%s", (data.estado, report_id))
            entry = connection.execute(
                """INSERT INTO reportes.reporte_historial
                   (id_reporte,id_administrador,estado_anterior,estado_nuevo,nota_interna)
                   VALUES (%s,%s,%s,%s,%s) RETURNING id_actuacion""",
                (report_id, administrator_id, previous, data.estado, data.nota_interna),
            ).fetchone()
            connection.execute("INSERT INTO reportes.outbox(id_actuacion) VALUES (%s)", (entry["id_actuacion"],))
            return connection.execute(DETAIL, (report_id,)).fetchone()

    def next_notification(self):
        with self.connect() as connection:
            return connection.execute("""
                WITH next AS (
                    SELECT o.id_actuacion FROM reportes.outbox o
                    JOIN reportes.reporte_historial h USING (id_actuacion)
                    WHERE o.entregado_en IS NULL AND o.proximo_intento <= clock_timestamp()
                      AND NOT EXISTS (
                          SELECT FROM reportes.reporte_historial previous
                          JOIN reportes.outbox waiting USING (id_actuacion)
                          WHERE previous.id_reporte=h.id_reporte
                            AND previous.id_actuacion<h.id_actuacion AND waiting.entregado_en IS NULL
                      )
                    ORDER BY o.proximo_intento,o.id_actuacion
                    LIMIT 1 FOR UPDATE OF o SKIP LOCKED
                ), claimed AS (
                    UPDATE reportes.outbox o SET proximo_intento=clock_timestamp()+interval '15 seconds'
                    FROM next n WHERE o.id_actuacion=n.id_actuacion RETURNING o.id_actuacion
                )
                SELECT c.id_actuacion,r.id_denunciante AS id_usuario,
                       r.id_reporte AS referencia_id,h.estado_nuevo AS estado
                FROM claimed c JOIN reportes.reporte_historial h USING (id_actuacion)
                JOIN reportes.reporte r USING (id_reporte)
            """).fetchone()

    def mark_delivered(self, action_id):
        with self.connect() as connection:
            connection.execute(
                """UPDATE reportes.outbox SET entregado_en=clock_timestamp()
                   WHERE id_actuacion=%s AND entregado_en IS NULL""", (action_id,),
            )
