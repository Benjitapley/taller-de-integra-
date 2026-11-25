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

    def get_by_id(self, user_id):
        with self.connect() as connection:
            row = connection.execute(self.select + " WHERE u.id_usuario=%s", (user_id,)).fetchone()
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

    def profile_fields(self, subject):
        with self.connect() as connection:
            return connection.execute("SELECT genero,id_region_interes,id_comuna_interes FROM auth_users.perfil_comun WHERE supabase_user_id=%s", (subject,)).fetchone() or {"genero":None,"id_region_interes":None,"id_comuna_interes":None}

    def swap_photo(self, subject, reference):
        with self.connect() as connection:
            condition = "id_usuario=(SELECT id_usuario FROM auth_users.identidad WHERE supabase_user_id=%s)" if self.progressive else "supabase_user_id=%s"
            old=connection.execute(f"SELECT foto_perfil FROM {self.table} WHERE {condition} FOR UPDATE", (subject,)).fetchone()
            if old is None: raise ValueError("Perfil inexistente")
            connection.execute(f"UPDATE {self.table} SET foto_perfil=%s WHERE {condition}", (reference,subject))
            if old['foto_perfil'] and old['foto_perfil'] != reference:
                connection.execute("INSERT INTO auth_users.foto_limpieza(subject,reference) VALUES(%s,%s) ON CONFLICT DO NOTHING", (subject,old['foto_perfil']))

    def photo_cleanup(self):
        with self.connect() as connection:
            return connection.execute("SELECT subject,reference FROM auth_users.foto_limpieza ORDER BY creada_en LIMIT 20").fetchall()

    def photo_referenced(self, reference):
        with self.connect() as connection:
            return bool(connection.execute(f"SELECT 1 FROM {self.table} WHERE foto_perfil=%s LIMIT 1",(reference,)).fetchone())

    def photo_cleaned(self, reference):
        with self.connect() as connection:
            connection.execute("DELETE FROM auth_users.foto_limpieza WHERE reference=%s",(reference,))

    def patch_canonical(self, subject, changes, expected):
        basic = {key:value.strip() or None if isinstance(value,str) else value for key,value in changes.items() if key in {"ocupacion","ciudad","breve_descripcion","sobre_mi"}}
        extra = {key:value for key,value in changes.items() if key in {"genero","id_region_interes","id_comuna_interes"}}
        if set(changes)-set(basic)-set(extra): raise ValueError("Campos no editables")
        with self.connect() as connection:
            condition = "id_usuario=(SELECT id_usuario FROM auth_users.identidad WHERE supabase_user_id=%s)" if self.progressive else "supabase_user_id=%s"
            locked = connection.execute(f"SELECT id_usuario FROM {self.table} WHERE {condition} FOR UPDATE", (subject,)).fetchone()
            if locked is None: raise ValueError("Perfil inexistente")
            current=connection.execute("SELECT genero,id_region_interes,id_comuna_interes FROM auth_users.perfil_comun WHERE supabase_user_id=%s", (subject,)).fetchone() or {"genero":None,"id_region_interes":None,"id_comuna_interes":None}
            if current != expected:
                from backend.service_runtime.contracts import RuleViolation
                raise RuleViolation("El perfil cambió; vuelve a consultarlo.",409)
            if basic:
                assignments = ",".join(f"{key}=%s" for key in basic)
                connection.execute(f"UPDATE {self.table} SET {assignments} WHERE {condition}", (*basic.values(),subject))
            if extra:
                columns=",".join(extra); values=",".join(["%s"]*len(extra))
                assignments=",".join(f"{key}=EXCLUDED.{key}" for key in extra)
                connection.execute(f"INSERT INTO auth_users.perfil_comun(supabase_user_id,{columns}) VALUES(%s,{values}) ON CONFLICT(supabase_user_id) DO UPDATE SET {assignments}", (subject,*extra.values()))
