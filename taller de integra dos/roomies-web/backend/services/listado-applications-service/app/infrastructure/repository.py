"""SQL exclusivamente en listado_applications; todas las entradas parametrizadas."""
from contextlib import contextmanager
import re
import psycopg
from psycopg.rows import dict_row
from backend.service_runtime.settings import database_url, persistence_layout
from backend.service_runtime.contracts import RuleViolation

SELECT="""SELECT p.*,(SELECT i.url FROM listado_applications.imagen_publicacion i
 WHERE i.id_publicacion=p.id_publicacion ORDER BY i.orden,i.id_imagen LIMIT 1) AS imagen
 FROM listado_applications.publicacion p"""


class PostgresPublications:
    def __init__(self):
        self.connection=None
        self.progressive = persistence_layout() == "haycupo-v1"
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

    def admin_list(self,limit,page):
        return self.query(self.select+" ORDER BY p.id_publicacion DESC LIMIT %s OFFSET %s",(limit+1,(page-1)*limit),True)
