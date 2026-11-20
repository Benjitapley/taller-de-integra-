import psycopg
from psycopg.rows import dict_row

from backend.service_runtime.settings import database_url


FIELDS = "id_reporte,tipo,id_usuario_reportado,id_publicacion_reportada,categoria,descripcion,estado,fecha"


class ReportRepository:
    def connect(self):
        return psycopg.connect(
            database_url("REPORTES_DATABASE_URL", "sql_reportes"),
            row_factory=dict_row, connect_timeout=3, prepare_threshold=None,
        )

    def create(self, actor_id, data):
        with self.connect() as connection:
            return connection.execute(
                f"""INSERT INTO reportes.reporte
                    (id_denunciante,id_usuario_reportado,id_publicacion_reportada,categoria,descripcion)
                    VALUES (%s,%s,%s,%s,%s) RETURNING {FIELDS}""",
                (actor_id, data.id_usuario_reportado, data.id_publicacion_reportada, data.categoria, data.descripcion),
            ).fetchone()

    def mine(self, actor_id, limit, before):
        boundary = " AND (fecha,id_reporte)<(%s,%s)" if before else ""
        with self.connect() as connection:
            return connection.execute(
                f"""SELECT {FIELDS} FROM reportes.reporte WHERE id_denunciante=%s{boundary}
                    ORDER BY fecha DESC,id_reporte DESC LIMIT %s""",
                (actor_id, *(before or ()), limit),
            ).fetchall()
