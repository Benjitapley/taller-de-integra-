"""Persistencia local exclusiva del esquema Auth/Users."""
import psycopg
from psycopg.rows import dict_row
from app.domain.local_users import User
from backend.service_runtime.contracts import DependencyUnavailable
from backend.service_runtime.settings import database_url, persistence_layout

FIELDS = "id_usuario,supabase_user_id,nombre,fecha_nacimiento,ocupacion,ciudad,breve_descripcion,sobre_mi,foto_perfil,presupuesto,zona_interes"
EDITABLE = {"ocupacion","ciudad","breve_descripcion","sobre_mi","foto_perfil","presupuesto","zona_interes"}


class PostgresUsers:
    def __init__(self):
        self.progressive = persistence_layout() == "haycupo-v1"
        self.table = "haycupo.usuario" if self.progressive else "auth_users.usuario"
        self.identity_column = "i.supabase_user_id" if self.progressive else "u.supabase_user_id"
        fields = ",".join(self.identity_column if key == "supabase_user_id" else "u." + key for key in FIELDS.split(","))
        self.select = f"SELECT {fields} FROM {self.table} u"
        if self.progressive:
            self.select += " LEFT JOIN auth_users.identidad i ON i.id_usuario=u.id_usuario"

    def connect(self):
        return psycopg.connect(database_url("AUTH_USERS_DATABASE_URL", "sql_auth_users"), row_factory=dict_row, connect_timeout=3, prepare_threshold=None)

    def get(self, subject):
        with self.connect() as connection:
            row = connection.execute(self.select + f" WHERE {self.identity_column}=%s", (subject,)).fetchone()
            return User(**row) if row else None

    def ensure(self, subject, name, birth_date):
        with self.connect() as connection:
            if self.progressive:
                # Serializar inicialización del mismo UUID, sin consultar ni enlazar por correo.
                connection.execute("SELECT pg_advisory_xact_lock(hashtextextended(%s,0))", (str(subject),))
                row = connection.execute(self.select + " WHERE i.supabase_user_id=%s", (subject,)).fetchone()
                if row: return User(**row)
                user_id = connection.execute("INSERT INTO haycupo.usuario(nombre,fecha_nacimiento) VALUES(%s,%s) RETURNING id_usuario", (name,birth_date)).fetchone()["id_usuario"]
                connection.execute("INSERT INTO auth_users.identidad(supabase_user_id,id_usuario) VALUES(%s,%s)", (subject,user_id))
            else:
                connection.execute("INSERT INTO auth_users.usuario (supabase_user_id,nombre,fecha_nacimiento) VALUES (%s,%s,%s) ON CONFLICT (supabase_user_id) DO NOTHING", (subject,name,birth_date))
            row = connection.execute(self.select + f" WHERE {self.identity_column}=%s", (subject,)).fetchone()
            return User(**row)

    def patch(self, subject, changes):
        with self.connect() as connection:
            return self._patch(connection, subject, changes)

    def _patch(self, connection, subject, changes):
        if not changes or set(changes) - EDITABLE:
            raise ValueError("Campos no permitidos")
        assignments = ",".join(f"{key}=%s" for key in changes)
        condition = "id_usuario=(SELECT id_usuario FROM auth_users.identidad WHERE supabase_user_id=%s)" if self.progressive else "supabase_user_id=%s"
        changed = connection.execute(f"UPDATE {self.table} SET {assignments} WHERE {condition}", (*changes.values(),subject))
        if changed.rowcount != 1:
            return None
        row = connection.execute(self.select + f" WHERE {self.identity_column}=%s", (subject,)).fetchone()
        return User(**row) if row else None

    def patch_with_photo(self, subject, changes, name, upload, old_key):
        # Registrar antes de subir: si cae el proceso, el candidato queda para limpieza.
        with self.connect() as connection:
            connection.execute(
                "INSERT INTO auth_users.limpieza_foto (objeto, disponible) VALUES (%s, now() + interval '15 minutes')",
                (name,),
            )
        with self.connect() as connection:
            candidate = connection.execute(
                "SELECT objeto FROM auth_users.limpieza_foto WHERE objeto=%s FOR UPDATE", (name,),
            ).fetchone()
            if candidate is None:
                raise RuntimeError("La carga de foto expiró.")
            previous = connection.execute(
                self.select + f" WHERE {self.identity_column}=%s FOR UPDATE OF u", (subject,),
            ).fetchone()
            if previous is None:
                return None
            upload()
            updated = self._patch(connection, subject, changes)
            if updated is None:
                raise RuntimeError("No se pudo actualizar la referencia de la foto.")
            prior = old_key(previous["foto_perfil"])
            if prior:
                connection.execute(
                    "INSERT INTO auth_users.limpieza_foto (objeto) VALUES (%s) ON CONFLICT DO NOTHING", (prior,),
                )
            connection.execute("DELETE FROM auth_users.limpieza_foto WHERE objeto=%s", (name,))
            return updated

    def clean_photos(self, delete):
        for _ in range(3):
            with self.connect() as connection:
                row = connection.execute("""
                    SELECT objeto FROM auth_users.limpieza_foto WHERE disponible <= now()
                    ORDER BY disponible, objeto LIMIT 1 FOR UPDATE SKIP LOCKED
                    """).fetchone()
                if row is None:
                    return
                name = row["objeto"]
                try:
                    delete(name)
                except DependencyUnavailable:
                    connection.execute(
                        "UPDATE auth_users.limpieza_foto SET disponible=now()+interval '5 minutes' WHERE objeto=%s",
                        (name,),
                    )
                else:
                    connection.execute("DELETE FROM auth_users.limpieza_foto WHERE objeto=%s", (name,))

    def public_search(self, filters):
        where, params = [], []
        for key, value in filters.items():
            if key == "ids":
                where.append("u.id_usuario=ANY(%s)"); params.append(value)
            elif key == "excluir_id":
                where.append("u.id_usuario<>%s")
                params.append(value)
            elif key == "presupuesto_max":
                where.append("u.presupuesto<=%s"); params.append(value)
            elif key == "zona":
                where.append("u.zona_interes ILIKE %s"); params.append("%"+value.replace("\\","\\\\").replace("%","\\%").replace("_","\\_")+"%")
            elif key == "ocupacion":
                where.append("u.ocupacion=%s"); params.append(value)
            else:
                raise ValueError("Filtro no permitido")
        condition = " WHERE " + " AND ".join(where) if where else ""
        with self.connect() as connection:
            return [User(**row) for row in connection.execute(self.select + condition + " ORDER BY u.id_usuario LIMIT 100", params).fetchall()]

    def notifications(self, user_id):
        with self.connect() as connection:
            return connection.execute("SELECT id,tipo,referencia_id,estado,creado_en FROM auth_users.notificacion WHERE id_usuario=%s ORDER BY id DESC LIMIT 100", (user_id,)).fetchall()

    def notification_page(self, user_id, limit, before):
        boundary = " AND (creado_en,id)<(%s,%s)" if before else ""
        with self.connect() as connection:
            return connection.execute(
                f"""SELECT id,tipo,referencia_id,creado_en FROM auth_users.notificacion
                    WHERE id_usuario=%s AND tipo IN ('Postulacion_Resultado','expulsion','reporte_actualizado'){boundary}
                    ORDER BY creado_en DESC,id DESC LIMIT %s""",
                (user_id, *(before or ()), limit),
            ).fetchall()

    def notify(self, event):
        with self.connect() as connection:
            columns = ("id_usuario", "tipo", "referencia_id", "estado")
            values = tuple(event[key] for key in columns)
            inserted = connection.execute(
                """INSERT INTO auth_users.notificacion (id_usuario,tipo,referencia_id,estado,event_key)
                   VALUES (%s,%s,%s,%s,%s) ON CONFLICT (event_key) DO NOTHING RETURNING id""",
                (*values, event["event_key"]),
            ).fetchone()
            if inserted is not None:
                return True
            existing = connection.execute(
                "SELECT id_usuario,tipo,referencia_id,estado FROM auth_users.notificacion WHERE event_key=%s",
                (event["event_key"],),
            ).fetchone()
            return existing is not None and tuple(existing[key] for key in columns) == values

    def count(self):
        with self.connect() as connection:
            return connection.execute(f"SELECT count(*) AS total FROM {self.table}").fetchone()["total"]

    def is_revoked(self,session_id):
        with self.connect() as connection:
            return connection.execute("SELECT 1 FROM auth_users.sesion_revocada WHERE session_id=%s",(session_id,)).fetchone() is not None

    def revoke(self,session_id,subject):
        with self.connect() as connection:
            connection.execute("INSERT INTO auth_users.sesion_revocada (session_id,subject) VALUES (%s,%s) ON CONFLICT DO NOTHING",(session_id,subject))
