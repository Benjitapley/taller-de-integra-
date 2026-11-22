"""SQL exclusivamente en listado_applications; todas las entradas parametrizadas."""
from contextlib import contextmanager
import re
import psycopg
from psycopg.rows import dict_row
from psycopg.types.json import Jsonb
from backend.service_runtime.settings import database_url, persistence_layout
from backend.service_runtime.contracts import RuleViolation
from app.infrastructure.admissions import AdmissionsRepository

SELECT="""SELECT p.*,(SELECT i.url FROM listado_applications.imagen_publicacion i
 WHERE i.id_publicacion=p.id_publicacion ORDER BY i.orden,i.id_imagen LIMIT 1) AS imagen
 ,COALESCE((SELECT jsonb_agg(jsonb_build_object('id_imagen',i.id_imagen,'url',i.url,'orden',i.orden) ORDER BY i.orden,i.id_imagen)
 FROM listado_applications.imagen_publicacion i WHERE i.id_publicacion=p.id_publicacion),'[]'::jsonb) AS imagenes
 ,(SELECT count(*) FROM listado_applications.admision_reserva r JOIN listado_applications.admision_operacion o USING(id_operacion)
 WHERE o.id_publicacion=p.id_publicacion AND r.estado='Reservada') AS cupos_reservados
 FROM listado_applications.publicacion p"""

VACANCIES="GREATEST(0,p.cupos_totales-p.ocupacion_confirmada-(SELECT count(*) FROM listado_applications.admision_reserva r JOIN listado_applications.admision_operacion o USING(id_operacion) WHERE o.id_publicacion=p.id_publicacion AND r.estado='Reservada'))"

APPLICATION_OPERATION=""" LEFT JOIN LATERAL (SELECT estado,jsonb_strip_nulls(jsonb_build_object(
 'id_operacion',id_operacion,'estado',estado,'codigo_error',codigo_error)) AS operacion
 FROM listado_applications.admision_operacion o WHERE o.id_postulacion=a.id_postulacion
 ORDER BY creado_en DESC,id_operacion DESC LIMIT 1) op ON true """


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

    def report_target(self, publication_id):
        return self.query(
            """SELECT id_publicacion,id_usuario AS id_propietario,tipo,estado,cupos_totales
               FROM listado_applications.publicacion WHERE id_publicacion=%s""", (publication_id,),
        )

    def list_publications(self,filters,owner=None):
        where,params=[],[]
        if owner is not None:
            where.append("p.id_usuario=%s");params.append(owner)
        else:
            where.extend(["p.tipo='Arrendador'","p.estado IN ('Disponible','Activa')","p.ocupacion_confirmada IS NOT NULL",VACANCIES+">0"])
        for key,op,column in [("precio_min",">=","precio"),("precio_max","<=","precio"),("tipo_vivienda","=","tipo_vivienda"),("mascota","=","mascota"),("categoria","=","categoria"),("id_region","=","id_region"),("id_comuna","=","id_comuna")]:
            if filters.get(key) is not None:
                where.append(f"p.{column}{op}%s");params.append(filters[key])
        for key, op in (("cupos_min", ">="), ("cupos_disponibles", "=")):
            if filters.get(key) is not None:
                where.append(f"{VACANCIES}{op}%s");params.append(filters[key])
        if filters.get("consulta"):
            value=filters["consulta"].replace("\\","\\\\").replace("%","\\%").replace("_","\\_")
            where.append("(p.titulo ILIKE %s OR p.ubicacion ILIKE %s OR p.descripcion ILIKE %s)");params.extend(["%"+value+"%"]*3)
        date_column = "m.fecha_publicacion" if self.progressive else "p.fecha_publicacion"
        if filters.get("after"):
            where.append(f"({date_column},p.id_publicacion)<(%s,%s)");params.extend(filters["after"])
        condition=" WHERE "+" AND ".join(where) if where else ""
        params.append(filters.get("limite",21))
        return self.query(self.select+condition+f" ORDER BY {date_column} DESC,p.id_publicacion DESC LIMIT %s",params,True)

    def regions(self):
        return self.query("SELECT id_region,nombre FROM listado_applications.region ORDER BY id_region",many=True)

    def communes(self,region):
        if not self.query("SELECT id_region FROM listado_applications.region WHERE id_region=%s",(region,)):
            raise RuleViolation("La región no existe.",404)
        return self.query("SELECT id_comuna,id_region,nombre FROM listado_applications.comuna WHERE id_region=%s ORDER BY nombre,id_comuna",(region,),True)

    def validate_location(self,region,commune):
        if not self.query("SELECT id_comuna FROM listado_applications.comuna WHERE id_region=%s AND id_comuna=%s",(region,commune)):
            raise RuleViolation("La comuna no pertenece a la región indicada.")

    def create(self,owner,data):
        data={**data,"ocupacion_confirmada":0,"version_ocupacion":0}
        if "reglas" in data: data={**data,"reglas":Jsonb(data["reglas"])}
        if self.progressive: data = {**data, "estado": "Disponible"}
        columns=tuple(data)
        id = self.query("INSERT INTO listado_applications.publicacion (id_usuario,"+",".join(columns)+") VALUES ("+",".join(["%s"]*(len(columns)+1))+") RETURNING id_publicacion",(owner,*data.values()))["id_publicacion"]
        if self.progressive:
            self.query("INSERT INTO listado_applications.publicacion_metadata(id_publicacion) VALUES(%s) RETURNING id_publicacion", (id,))
        return id

    def update(self,id,data):
        if self.connection is None:
            with self.transaction(): return self.update(id,data)
        previous=self.publication(id,lock=True)
        if previous is None: raise RuleViolation("Publicación no encontrada.",404)
        if data.get("cupos_totales",previous["cupos_totales"])!=previous["cupos_totales"]:
            if AdmissionsRepository(self).busy(id):
                raise RuleViolation("Hay una incorporación pendiente; no puedes cambiar capacidad.",409)
            # shortcut: capacidad con residentes se coordinará con Convivencia en C04.
            if previous["estado"]=="Activa" or previous["ocupacion_confirmada"] not in (0,):
                raise RuleViolation("Cambiar capacidad con residentes requiere coordinación con Convivencia.",409)
            data={**data,"version_capacidad":previous["version_capacidad"]+1}
        if "reglas" in data: data={**data,"reglas":Jsonb(data["reglas"])}
        self.query("UPDATE listado_applications.publicacion SET "+",".join(k+"=%s" for k in data)+" WHERE id_publicacion=%s RETURNING id_publicacion",(*data.values(),id))

    def close(self,id):
        self.query("UPDATE listado_applications.publicacion SET estado='Cerrada',version_capacidad=version_capacidad+1 WHERE id_publicacion=%s AND estado<>'Cerrada' RETURNING id_publicacion",(id,))

    def update_occupancy(self,id,count,version):
        return self.query("UPDATE listado_applications.publicacion SET ocupacion_confirmada=%s,version_ocupacion=%s,estado=CASE WHEN estado='Cerrada' THEN estado WHEN %s>0 THEN 'Activa' ELSE 'Disponible' END WHERE id_publicacion=%s RETURNING id_publicacion",(count,version,count,id))

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
            return self.query("SELECT a.*,p.titulo,p.estado AS estado_publicacion,op.operacion,COALESCE(op.estado='Pendiente',false) AS incorporacion_pendiente FROM listado_applications.postulacion a JOIN listado_applications.publicacion p USING (id_publicacion)"+APPLICATION_OPERATION+" WHERE a.id_usuario=%s ORDER BY a.fecha_postulacion DESC,a.id_postulacion DESC LIMIT 100",(owner,),True)
        return self.query("SELECT a.*,op.operacion,COALESCE(op.estado='Pendiente',false) AS incorporacion_pendiente FROM listado_applications.postulacion a"+APPLICATION_OPERATION+" WHERE a.id_publicacion=%s ORDER BY a.fecha_postulacion DESC,a.id_postulacion DESC LIMIT 100",(publication,),True)

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
