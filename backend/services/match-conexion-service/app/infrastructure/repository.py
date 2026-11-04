"""Repositorio exclusivo de match_conexion, con unicidad simétrica en SQL."""
from contextlib import contextmanager
import psycopg
from psycopg.rows import dict_row
from backend.service_runtime.settings import database_url, persistence_layout
from backend.service_runtime.contracts import RuleViolation


class PostgresConnections:
    def __init__(self):
        self.connection=None
        self.progressive = persistence_layout() == "haycupo-v1"

    def connect(self):
        return psycopg.connect(database_url("MATCH_DATABASE_URL","sql_match_conexion"),row_factory=dict_row,connect_timeout=3,prepare_threshold=None)

    @contextmanager
    def transaction(self):
        with self.connect() as connection:
            self.connection=connection
            try: yield self
            finally: self.connection=None

    def query(self,sql,params=(),many=False):
        if self.progressive: sql = sql.replace("match_conexion.conexion", "haycupo.conexion")
        if self.connection is not None:
            cursor=self.connection.execute(sql,params)
            return cursor.fetchall() if many else cursor.fetchone()
        with self.connect() as connection:
            cursor=connection.execute(sql,params)
            return cursor.fetchall() if many else cursor.fetchone()

    def create(self,sender,receiver):
        try:
            if self.progressive:
                # El bloqueo de pareja coordina instancias nuevas sin imponer un índice al legado.
                self.query("SELECT pg_advisory_xact_lock(hashtextextended(%s,0))", (f"conexion:{min(sender,receiver)}:{max(sender,receiver)}",))
                existing = self.query('SELECT id_conexion FROM match_conexion.conexion WHERE LEAST("id_solicitante_FK","id_receptor_FK")=%s AND GREATEST("id_solicitante_FK","id_receptor_FK")=%s AND estado IN (\'Pendiente\',\'Aceptada\')', (min(sender,receiver),max(sender,receiver)))
                if existing: raise RuleViolation("Ya existe una conexión vigente entre ambas cuentas.",400)
                return self.query('INSERT INTO match_conexion.conexion ("id_solicitante_FK","id_receptor_FK",estado,fecha_solicitud) VALUES (%s,%s,\'Pendiente\',clock_timestamp() AT TIME ZONE \'UTC\') RETURNING *',(sender,receiver))
            return self.query('INSERT INTO match_conexion.conexion ("id_solicitante_FK","id_receptor_FK") VALUES (%s,%s) RETURNING *',(sender,receiver))
        except psycopg.errors.UniqueViolation:
            raise RuleViolation("Ya existe una conexión vigente entre ambas cuentas.",400) from None

    def get(self,id,lock=False):
        return self.query("SELECT * FROM match_conexion.conexion WHERE id_conexion=%s"+(" FOR UPDATE" if lock else ""),(id,))

    def change(self,id,state):
        return self.query("UPDATE match_conexion.conexion SET estado=%s WHERE id_conexion=%s RETURNING *",(state,id))

    def delete(self,id):
        self.query("DELETE FROM match_conexion.conexion WHERE id_conexion=%s RETURNING id_conexion",(id,))

    def own(self,user_id,view):
        if view=="recibidas":
            condition='"id_receptor_FK"=%s AND estado=\'Pendiente\'';params=(user_id,)
        elif view=="enviadas":
            condition='"id_solicitante_FK"=%s';params=(user_id,)
        elif view=="aceptadas":
            condition='("id_solicitante_FK"=%s OR "id_receptor_FK"=%s) AND estado=\'Aceptada\'';params=(user_id,user_id)
        else: raise ValueError("Vista no permitida")
        return self.query("SELECT * FROM match_conexion.conexion WHERE "+condition+" ORDER BY fecha_solicitud DESC LIMIT 100",params,True)

    def count(self):
        return self.query("SELECT count(*) AS total FROM match_conexion.conexion")["total"]
