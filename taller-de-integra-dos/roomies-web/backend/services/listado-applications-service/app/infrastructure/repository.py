"""SQL exclusivamente en listado_applications; todas las entradas parametrizadas."""
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone
import re
import psycopg
from psycopg.rows import dict_row
from backend.service_runtime.settings import database_url, persistence_layout
from backend.service_runtime.contracts import DependencyUnavailable, RuleViolation

SELECT="""SELECT p.*,(SELECT i.url FROM listado_applications.imagen_publicacion i
 WHERE i.id_publicacion=p.id_publicacion ORDER BY i.orden,i.id_imagen LIMIT 1) AS imagen
 FROM listado_applications.publicacion p"""


class PostgresPublications:
    def __init__(self):
        self.connection=None
        self.progressive = persistence_layout() == "haycupo-v1"
        self.capacity_schema = "haycupo" if self.progressive else "listado_applications"
        self.select = SELECT
        if self.progressive:
            self.select = SELECT.replace("SELECT p.*,", "SELECT p.*,m.fecha_publicacion,") + " LEFT JOIN listado_applications.publicacion_metadata m USING(id_publicacion)"

    def connect(self):
        return psycopg.connect(database_url("LISTADO_DATABASE_URL","sql_listado_applications"),row_factory=dict_row,connect_timeout=3,prepare_threshold=None)

    @contextmanager
    def transaction(self):
        with self.connect() as connection:
            self.connection=connection
            try: yield self
            finally: self.connection=None

    def query(self,sql,params=(),many=False):
        if self.progressive:
            sql = re.sub(r"\blistado_applications\.(publicacion|imagen_publicacion)\b", r"haycupo.\1", sql)
        if self.connection is not None:
            cursor=self.connection.execute(sql,params)
            return cursor.fetchall() if many else cursor.fetchone()
        with self.connect() as connection:
            cursor=connection.execute(sql,params)
            return cursor.fetchall() if many else cursor.fetchone()

    def publication(self,id,lock=False):
        return self.query(self.select+" WHERE p.id_publicacion=%s"+(" FOR UPDATE OF p" if lock else ""),(id,))

    def list_publications(self,filters,owner=None):
        where,params=[],[]
        if owner is not None:
            where.append("p.id_usuario=%s");params.append(owner)
        else:
            where.extend(["p.estado IN ('Disponible','Activa')","p.cupos_totales>0"])
        for key,op,column in [("precio_min",">=","precio"),("precio_max","<=","precio"),("cupos_min",">=","cupos_totales"),("tipo_vivienda","=","tipo_vivienda"),("mascota","=","mascota"),("categoria","=","categoria")]:
            if filters.get(key) is not None:
                where.append(f"p.{column}{op}%s");params.append(filters[key])
        if filters.get("consulta"):
            value=filters["consulta"].replace("\\","\\\\").replace("%","\\%").replace("_","\\_")
            where.append("(p.titulo ILIKE %s OR p.ubicacion ILIKE %s OR p.descripcion ILIKE %s)");params.extend(["%"+value+"%"]*3)
        condition=" WHERE "+" AND ".join(where) if where else ""
        params.extend([filters.get("limite",100),filters.get("offset",0)])
        date_column = "m.fecha_publicacion" if self.progressive else "p.fecha_publicacion"
        return self.query(self.select+condition+f" ORDER BY {date_column} DESC NULLS LAST,p.id_publicacion DESC LIMIT %s OFFSET %s",params,True)

    def create(self,owner,data):
        if self.progressive: data = {**data, "estado": "Disponible"}
        columns=tuple(data)
        id = self.query("INSERT INTO listado_applications.publicacion (id_usuario,"+",".join(columns)+") VALUES ("+",".join(["%s"]*(len(columns)+1))+") RETURNING id_publicacion",(owner,*data.values()))["id_publicacion"]
        if self.progressive:
            self.query("INSERT INTO listado_applications.publicacion_metadata(id_publicacion) VALUES(%s) RETURNING id_publicacion", (id,))
        return id

    def update(self,id,data):
        self.query("UPDATE listado_applications.publicacion SET "+",".join(k+"=%s" for k in data)+" WHERE id_publicacion=%s RETURNING id_publicacion",(*data.values(),id))

    def close(self,id):
        self.query("UPDATE listado_applications.publicacion SET estado='Cerrada' WHERE id_publicacion=%s RETURNING id_publicacion",(id,))

    def image(self,id,reference):
        old=self.query("SELECT id_imagen FROM listado_applications.imagen_publicacion WHERE id_publicacion=%s ORDER BY orden,id_imagen LIMIT 1",(id,))
        if old:
            self.query("UPDATE listado_applications.imagen_publicacion SET url=%s WHERE id_imagen=%s RETURNING id_imagen",(reference,old["id_imagen"]))
        else:
            self.query("INSERT INTO listado_applications.imagen_publicacion (id_publicacion,url,orden) VALUES (%s,%s,0) RETURNING id_imagen",(id,reference))

    def postulate(self,id,user_id):
        try:
            return self.query("INSERT INTO listado_applications.postulacion (id_publicacion,id_usuario) VALUES (%s,%s) RETURNING *",(id,user_id))
        except psycopg.errors.UniqueViolation:
            raise RuleViolation("Ya existe una postulación vigente.",409) from None

    def application(self,id,lock=False):
        return self.query("SELECT * FROM listado_applications.postulacion WHERE id_postulacion=%s"+(" FOR UPDATE" if lock else ""),(id,))

    def applications(self,owner=None,publication=None):
        if owner is not None:
            return self.query("SELECT a.*,p.titulo,p.estado AS estado_publicacion FROM listado_applications.postulacion a JOIN listado_applications.publicacion p USING (id_publicacion) WHERE a.id_usuario=%s ORDER BY a.fecha_postulacion DESC LIMIT 100",(owner,),True)
        return self.query("SELECT * FROM listado_applications.postulacion WHERE id_publicacion=%s ORDER BY fecha_postulacion DESC LIMIT 100",(publication,),True)

    def change(self,id,state,reason):
        return self.query("UPDATE listado_applications.postulacion SET estado=%s,motivo=%s,actualizada_en=clock_timestamp() WHERE id_postulacion=%s RETURNING *",(state,reason,id))

    def event(self,application):
        key=f"postulacion:{application['id_postulacion']}:{application['estado']}"
        self.query("INSERT INTO listado_applications.outbox (event_key,id_usuario,referencia_id,estado) VALUES (%s,%s,%s,%s) ON CONFLICT DO NOTHING RETURNING event_key",(key,application["id_usuario"],application["id_postulacion"],application["estado"]))

    def pending_events(self):
        return self.query("SELECT event_key,id_usuario,referencia_id,estado FROM listado_applications.outbox WHERE NOT enviado LIMIT 50",many=True)

    def delivered(self,key):
        self.query("UPDATE listado_applications.outbox SET enviado=TRUE WHERE event_key=%s RETURNING event_key",(key,))

    def count(self,owner=None):
        where=" WHERE id_usuario=%s" if owner is not None else ""
        return self.query("SELECT count(*) AS total FROM listado_applications.publicacion"+where,(owner,) if owner is not None else ())["total"]

    def internal_publication(self, publication_id):
        row = self.publication(publication_id)
        if row is None:
            raise RuleViolation("Publicación no encontrada.", 404)
        return {
            "id_publicacion": row["id_publicacion"],
            "id_usuario": row["id_usuario"],
            "tipo": row["tipo"],
            "estado": row["estado"],
            "cupos_totales": row["cupos_totales"],
        }

    def reserve_capacity(self, event_key, publication_id, application_id, user_id):
        reservations = f"{self.capacity_schema}.reserva_cupo"
        occupancies = f"{self.capacity_schema}.publicacion_ocupacion"
        with self.transaction():
            publication = self.publication(publication_id, lock=True)
            if publication is None:
                raise RuleViolation("Publicación no encontrada.", 404)
            if publication["tipo"] != "Arrendador" or publication["id_usuario"] == user_id:
                raise RuleViolation("La publicación no admite esta incorporación.", 403)
            if publication["estado"] == "Cerrada":
                raise RuleViolation("La publicación está cerrada.", 409)
            application = self.query(
                "SELECT id_publicacion,id_usuario,estado "
                "FROM listado_applications.postulacion WHERE id_postulacion=%s",
                (application_id,),
            )
            if (application is None
                    or application["id_publicacion"] != publication_id
                    or application["id_usuario"] != user_id
                    or application["estado"] not in {"Pendiente","Preseleccionada","Aceptada"}):
                raise RuleViolation("La postulación no admite esta incorporación.", 409)

            existing = self.query(
                f"SELECT * FROM {reservations} WHERE event_key=%s FOR UPDATE",
                (event_key,),
            )
            if existing is not None:
                if (existing["id_publicacion"] != publication_id
                        or existing["id_postulacion"] != application_id
                        or existing["id_usuario"] != user_id):
                    raise RuleViolation("La clave de reserva ya se usó con otros datos.", 409)
                if (existing["estado"] == "Confirmada"
                        or existing["estado"] == "Reservada"
                        and existing["expira_en"] > datetime.now(timezone.utc)):
                    return self._reservation_dto(existing, publication)

            occupancy = self.query(
                f"SELECT * FROM {occupancies} WHERE id_publicacion=%s",
                (publication_id,),
            )
            if publication["estado"] == "Activa" and occupancy is None:
                raise DependencyUnavailable("Falta reconciliar la ocupación de la publicación.")
            if occupancy is not None and occupancy["estado"] == "Cerrada":
                raise RuleViolation("La publicación está cerrada.", 409)
            occupied = occupancy["cupos_ocupados"] if occupancy else 0
            exclusion = " AND id_reserva<>%s" if existing is not None else ""
            params = (publication_id, existing["id_reserva"]) if existing else (publication_id,)
            held = self.query(
                f"SELECT count(*) AS total FROM {reservations} "
                "WHERE id_publicacion=%s AND estado='Reservada' "
                "AND expira_en>clock_timestamp()" + exclusion,
                params,
            )["total"]
            if occupied + held >= publication["cupos_totales"]:
                raise RuleViolation("No quedan cupos disponibles.", 409)

            expires_at = datetime.now(timezone.utc) + timedelta(minutes=5)
            version = occupancy["version_ocupacion"] if occupancy else 0
            if existing is not None:
                row = self.query(
                    f"UPDATE {reservations} SET estado='Reservada',"
                    "version_capacidad=%s,expira_en=%s "
                    "WHERE id_reserva=%s RETURNING *",
                    (version, expires_at, existing["id_reserva"]),
                )
            else:
                row = self.query(
                    f"INSERT INTO {reservations} "
                    "(event_key,id_publicacion,id_postulacion,id_usuario,"
                    "version_capacidad,expira_en) VALUES (%s,%s,%s,%s,%s,%s) "
                    "RETURNING *",
                    (event_key, publication_id, application_id, user_id, version, expires_at),
                )
            return self._reservation_dto(row, publication)

    @staticmethod
    def _reservation_dto(row, publication):
        return {
            "id_reserva": row["id_reserva"],
            "id_publicacion": row["id_publicacion"],
            "id_postulacion": row["id_postulacion"],
            "id_usuario": row["id_usuario"],
            "id_arrendador": publication["id_usuario"],
            "cupos_totales": publication["cupos_totales"],
            "version_capacidad": row["version_capacidad"],
            "expires_at": row["expira_en"],
            "estado": row["estado"],
        }

    def release_capacity(self, event_key, publication_id):
        table = f"{self.capacity_schema}.reserva_cupo"
        return self.query(
            f"UPDATE {table} SET estado='Liberada' "
            "WHERE event_key=%s AND id_publicacion=%s AND estado='Reservada' "
            "RETURNING id_reserva",
            (event_key, publication_id),
        )

    def update_occupancy(self, data):
        reservations = f"{self.capacity_schema}.reserva_cupo"
        occupancies = f"{self.capacity_schema}.publicacion_ocupacion"
        publication_id = data["id_publicacion"]
        with self.transaction():
            publication = self.publication(publication_id, lock=True)
            if publication is None:
                raise RuleViolation("Publicación no encontrada.", 404)
            if data["cupos_ocupados"] > publication["cupos_totales"]:
                raise RuleViolation("La capacidad no coincide con la publicación.", 409)
            if data["estado"] not in {"Activa", "Cerrada"}:
                raise RuleViolation("Estado de ocupación inválido.")

            reservation_id = data.get("id_reserva")
            if reservation_id is not None:
                reservation = self.query(
                    f"SELECT * FROM {reservations} WHERE id_reserva=%s FOR UPDATE",
                    (reservation_id,),
                )
                if (reservation is None
                        or reservation["id_publicacion"] != publication_id
                        or reservation["event_key"] != data.get("clave_incorporacion")
                        or reservation["id_usuario"] != data["id_usuario"]
                        or reservation["estado"] not in {"Reservada", "Confirmada"}):
                    raise RuleViolation("La reserva no coincide con la ocupación.", 409)
                self.query(
                    f"UPDATE {reservations} SET estado='Confirmada' "
                    "WHERE id_reserva=%s RETURNING id_reserva",
                    (reservation_id,),
                )

            current = self.query(
                f"SELECT * FROM {occupancies} WHERE id_publicacion=%s FOR UPDATE",
                (publication_id,),
            )
            if current is not None and data["version_ocupacion"] < current["version_ocupacion"]:
                return {"actualizado": False, "version_ocupacion": current["version_ocupacion"]}
            if ((current is not None and current["estado"] == "Cerrada"
                 or publication["estado"] == "Cerrada")
                    and data["estado"] != "Cerrada"):
                raise RuleViolation("Una publicación cerrada no puede reabrirse.", 409)
            if current is not None and data["version_ocupacion"] == current["version_ocupacion"]:
                if (current["event_key"] == data["event_key"]
                        and current["cupos_ocupados"] == data["cupos_ocupados"]
                        and current["estado"] == data["estado"]):
                    return {"actualizado": False, "version_ocupacion": current["version_ocupacion"]}
                raise RuleViolation("La versión de ocupación ya existe con otros datos.", 409)

            if current is None:
                self.query(
                    f"INSERT INTO {occupancies} "
                    "(id_publicacion,version_ocupacion,cupos_ocupados,estado,event_key) "
                    "VALUES (%s,%s,%s,%s,%s) RETURNING id_publicacion",
                    (
                        publication_id, data["version_ocupacion"],
                        data["cupos_ocupados"], data["estado"], data["event_key"],
                    ),
                )
            else:
                self.query(
                    f"UPDATE {occupancies} SET version_ocupacion=%s,"
                    "cupos_ocupados=%s,estado=%s,event_key=%s "
                    "WHERE id_publicacion=%s RETURNING id_publicacion",
                    (
                        data["version_ocupacion"], data["cupos_ocupados"],
                        data["estado"], data["event_key"], publication_id,
                    ),
                )
            self.query(
                "UPDATE listado_applications.publicacion SET estado=%s "
                "WHERE id_publicacion=%s RETURNING id_publicacion",
                (
                    "Cerrada" if data["estado"] == "Cerrada" else "Activa",
                    publication_id,
                ),
            )
            if data["estado"] == "Cerrada":
                self.query(
                    f"UPDATE {reservations} SET estado='Liberada' "
                    "WHERE id_publicacion=%s AND estado='Reservada' "
                    "RETURNING id_reserva",
                    (publication_id,),
                    many=True,
                )
            return {
                "actualizado": True,
                "version_ocupacion": data["version_ocupacion"],
            }

    def admin_list(self,limit,page):
        return self.query(self.select+" ORDER BY p.id_publicacion DESC LIMIT %s OFFSET %s",(limit+1,(page-1)*limit),True)
