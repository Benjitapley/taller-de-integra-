"""Persistencia local exclusiva del esquema Auth/Users."""
import psycopg
from psycopg.rows import dict_row
from app.domain.local_users import User
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
        if not changes or set(changes) - EDITABLE:
            raise ValueError("Campos no permitidos")
        assignments = ",".join(f"{key}=%s" for key in changes)
        with self.connect() as connection:
            condition = "id_usuario=(SELECT id_usuario FROM auth_users.identidad WHERE supabase_user_id=%s)" if self.progressive else "supabase_user_id=%s"
            connection.execute(f"UPDATE {self.table} SET {assignments} WHERE {condition}", (*changes.values(),subject))
            row = connection.execute(self.select + f" WHERE {self.identity_column}=%s", (subject,)).fetchone()
            return User(**row) if row else None

    def public_search(self, filters):
        where, params = [], []
        for key, value in filters.items():
            if key == "ids":
                where.append("u.id_usuario=ANY(%s)"); params.append(value)
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

    def notify(self, event):
        with self.connect() as connection:
            connection.execute("INSERT INTO auth_users.notificacion (id_usuario,event_key,tipo,referencia_id,estado) VALUES (%s,%s,'Postulacion_Resultado',%s,%s) ON CONFLICT (event_key) DO NOTHING", (event["id_usuario"],event["event_key"],event["referencia_id"],event["estado"]))

    def notifications(self, user_id):
        with self.connect() as connection:
            return connection.execute("SELECT id,tipo,referencia_id,estado,creado_en FROM auth_users.notificacion WHERE id_usuario=%s ORDER BY id DESC LIMIT 100", (user_id,)).fetchall()

    def count(self):
        with self.connect() as connection:
            return connection.execute(f"SELECT count(*) AS total FROM {self.table}").fetchone()["total"]

    def is_revoked(self,session_id):
        with self.connect() as connection:
            return connection.execute("SELECT 1 FROM auth_users.sesion_revocada WHERE session_id=%s",(session_id,)).fetchone() is not None

    def revoke(self,session_id,subject):
        with self.connect() as connection:
            connection.execute("INSERT INTO auth_users.sesion_revocada (session_id,subject) VALUES (%s,%s) ON CONFLICT DO NOTHING",(session_id,subject))
