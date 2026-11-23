"""Ledger y bloqueos de admisión; no mantiene transacciones durante HTTP."""
from contextlib import contextmanager
import json
from psycopg.types.json import Jsonb


class AdmissionsRepository:
    def __init__(self,repository):
        self.repository=repository

    def operation(self,key):
        return self.repository.query("SELECT * FROM listado_applications.admision_operacion WHERE id_operacion=%s",(key,))

    def latest(self,application):
        return self.repository.query("SELECT * FROM listado_applications.admision_operacion WHERE id_postulacion=%s ORDER BY creado_en DESC,id_operacion DESC LIMIT 1",(application,))

    def insert(self,key,actor,application,publication,request):
        return self.repository.query("""INSERT INTO listado_applications.admision_operacion
          (id_operacion,id_actor,id_postulacion,id_publicacion,id_usuario,version_capacidad,solicitud)
          VALUES(%s,%s,%s,%s,%s,%s,%s) RETURNING *""",
          (key,actor,application["id_postulacion"],publication["id_publicacion"],application["id_usuario"],publication["version_capacidad"],Jsonb(request)))

    def reservation(self,key):
        return self.repository.query("SELECT * FROM listado_applications.admision_reserva WHERE id_operacion=%s",(key,))

    def reserved(self,publication):
        return self.repository.query("""SELECT count(*) AS total FROM listado_applications.admision_reserva r
          JOIN listado_applications.admision_operacion o USING(id_operacion)
          WHERE o.id_publicacion=%s AND r.estado='Reservada'""",(publication,))["total"]

    def busy(self,publication):
        return self.repository.query("""SELECT EXISTS(SELECT FROM listado_applications.admision_operacion
          WHERE id_publicacion=%s AND estado='Pendiente') OR EXISTS(
          SELECT FROM listado_applications.admision_reserva r JOIN listado_applications.admision_operacion o USING(id_operacion)
          WHERE o.id_publicacion=%s AND r.estado='Reservada') AS busy""",(publication,publication))["busy"]

    def reserve(self,key):
        return self.repository.query("INSERT INTO listado_applications.admision_reserva(id_operacion) VALUES(%s) RETURNING *",(key,))

    def confirm(self,key,projection):
        return self.repository.query("UPDATE listado_applications.admision_reserva SET estado='Confirmada',id_arriendo=%s,proyeccion=%s WHERE id_operacion=%s RETURNING *",(projection["id_arriendo"],Jsonb(projection),key))

    def release(self,key):
        return self.repository.query("UPDATE listado_applications.admision_reserva SET estado='Liberada' WHERE id_operacion=%s RETURNING *",(key,))

    def finish(self,key,status,body,error=None,result=None):
        return self.repository.query("""UPDATE listado_applications.admision_operacion SET estado=%s,
          codigo_error=%s,http_status=%s,respuesta=%s,resultado=%s WHERE id_operacion=%s RETURNING *""",
          ("Confirmada" if status==200 else "Rechazada",error,status,Jsonb(body),Jsonb(result,dumps=lambda value:json.dumps(value,default=lambda item:item.isoformat())),key))

    def pending(self):
        return self.repository.query("SELECT * FROM listado_applications.admision_operacion WHERE estado='Pendiente' ORDER BY ultimo_intento NULLS FIRST,creado_en LIMIT 20",many=True)

    @contextmanager
    def delivery(self,key):
        with self.repository.connect() as connection:
            connection.autocommit=True
            name=f"admision:{key}"
            acquired=connection.execute("SELECT pg_try_advisory_lock(hashtextextended(%s,0)) AS acquired",(name,)).fetchone()["acquired"]
            try:
                if acquired:
                    self.repository.query("UPDATE listado_applications.admision_operacion SET ultimo_intento=clock_timestamp() WHERE id_operacion=%s RETURNING id_operacion",(key,))
                yield acquired
            finally:
                if acquired: connection.execute("SELECT pg_advisory_unlock(hashtextextended(%s,0))",(name,))
