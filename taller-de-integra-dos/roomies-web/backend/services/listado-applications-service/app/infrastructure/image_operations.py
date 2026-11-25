"""Journal y limpieza de Storage, propiedad exclusiva de Listado."""
from contextlib import contextmanager
from psycopg.types.json import Jsonb


class ImageOperations:
    def __init__(self, repository):
        self.repository = repository

    @contextmanager
    def lock(self, actor, key, wait=True):
        # Lock de sesión: el journal se confirma antes de subir cualquier objeto.
        with self.repository.connect() as connection:
            connection.autocommit = True
            name = f"publication-images:{actor}:{key}"
            if wait:
                connection.execute("SELECT pg_advisory_lock(hashtextextended(%s,0))", (name,))
                acquired = True
            else:
                acquired = connection.execute("SELECT pg_try_advisory_lock(hashtextextended(%s,0)) AS acquired", (name,)).fetchone()["acquired"]
            try:
                yield acquired
            finally:
                if acquired:
                    connection.execute("SELECT pg_advisory_unlock(hashtextextended(%s,0))", (name,))

    def operation(self, actor, key):
        return self.repository.query("SELECT * FROM listado_applications.publication_image_operation WHERE id_usuario=%s AND operation_key=%s", (actor, key))

    def prepare(self, actor, key, fingerprint, publication, version, plan):
        return self.repository.query("""INSERT INTO listado_applications.publication_image_operation
            (id_usuario,operation_key,fingerprint,id_publicacion,base_version,plan)
            VALUES(%s,%s,%s,%s,%s,%s) RETURNING *""", (actor, key, fingerprint, publication, version, Jsonb(plan)))

    def touch(self, actor, key):
        self.repository.query("""UPDATE listado_applications.publication_image_operation SET touched_at=clock_timestamp()
            WHERE id_usuario=%s AND operation_key=%s RETURNING operation_key""", (actor, key))

    def images(self, publication):
        return self.repository.query("SELECT * FROM listado_applications.imagen_publicacion WHERE id_publicacion=%s ORDER BY orden,id_imagen", (publication,), True)

    def replace(self, publication, owner, retained, new):
        old = self.images(publication)
        discarded = [row for row in old if row["id_imagen"] not in retained]
        for row in discarded:
            if row.get("bucket") == "publicaciones" and row.get("object_path"):
                self.repository.query("""INSERT INTO listado_applications.publication_image_cleanup(object_path)
                    VALUES(%s) ON CONFLICT DO NOTHING RETURNING object_path""", (row["object_path"],))
            self.repository.query("DELETE FROM listado_applications.imagen_publicacion WHERE id_imagen=%s RETURNING id_imagen", (row["id_imagen"],))
        for order, image_id in enumerate(retained):
            self.repository.query("UPDATE listado_applications.imagen_publicacion SET orden=%s WHERE id_imagen=%s RETURNING id_imagen", (order, image_id))
        for order, image in enumerate(new, len(retained)):
            self.repository.query("""INSERT INTO listado_applications.imagen_publicacion
                (id_publicacion,id_usuario,url,orden,bucket,object_path,mime,size_bytes)
                VALUES(%s,%s,%s,%s,'publicaciones',%s,%s,%s) RETURNING id_imagen""",
                (publication, owner, image["url"], order, image["object_path"], image["mime"], image["size_bytes"]))
        self.repository.query("UPDATE listado_applications.publicacion SET version_imagenes=version_imagenes+1 WHERE id_publicacion=%s RETURNING id_publicacion", (publication,))

    def complete(self, actor, key, publication):
        self.repository.query("""UPDATE listado_applications.publication_image_operation SET estado='Complete',
            id_publicacion=%s,touched_at=clock_timestamp() WHERE id_usuario=%s AND operation_key=%s RETURNING operation_key""", (publication, actor, key))

    def referenced(self, path):
        return bool(self.repository.query("SELECT id_imagen FROM listado_applications.imagen_publicacion WHERE bucket='publicaciones' AND object_path=%s LIMIT 1", (path,)))

    def pending_cleanup(self):
        return self.repository.query("SELECT object_path FROM listado_applications.publication_image_cleanup ORDER BY created_at LIMIT 50", many=True)

    def cleaned(self, path):
        self.repository.query("DELETE FROM listado_applications.publication_image_cleanup WHERE object_path=%s RETURNING object_path", (path,))

    def abandoned(self):
        return self.repository.query("""SELECT * FROM listado_applications.publication_image_operation
            WHERE estado='Prepared' AND touched_at<clock_timestamp()-interval '15 minutes'
            ORDER BY touched_at LIMIT 20""", many=True)

    def expire(self, actor, key):
        self.repository.query("""UPDATE listado_applications.publication_image_operation SET estado='Cleaned', touched_at=clock_timestamp()
            WHERE id_usuario=%s AND operation_key=%s AND estado='Prepared' RETURNING operation_key""", (actor, key))

    def restart(self, actor, key):
        self.repository.query("""UPDATE listado_applications.publication_image_operation SET estado='Prepared',touched_at=clock_timestamp()
            WHERE id_usuario=%s AND operation_key=%s RETURNING operation_key""", (actor, key))
