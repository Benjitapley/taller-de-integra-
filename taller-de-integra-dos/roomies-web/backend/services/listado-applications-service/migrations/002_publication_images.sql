-- Aditiva: conserva URLs heredadas; no afirma haberlas trasladado a Storage.
BEGIN;
DO $$ DECLARE target_schema text; BEGIN
 SELECT n.nspname INTO target_schema FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
 WHERE c.relname='publicacion' AND c.relkind IN ('r','p') AND n.nspname IN ('listado_applications','haycupo')
 ORDER BY (n.nspname='listado_applications') DESC LIMIT 1;
 IF target_schema IS NULL THEN RAISE EXCEPTION 'Falta publicacion: aplicar base de Listado antes'; END IF;
 EXECUTE format('ALTER TABLE %I.publicacion ADD COLUMN IF NOT EXISTS version_imagenes bigint NOT NULL DEFAULT 0',target_schema);
 EXECUTE format('ALTER TABLE %I.imagen_publicacion
   ADD COLUMN IF NOT EXISTS id_usuario bigint,
   ADD COLUMN IF NOT EXISTS bucket text,
   ADD COLUMN IF NOT EXISTS object_path text,
   ADD COLUMN IF NOT EXISTS mime text,
   ADD COLUMN IF NOT EXISTS size_bytes bigint',target_schema);
 EXECUTE format('UPDATE %I.imagen_publicacion i SET id_usuario=p.id_usuario FROM %I.publicacion p WHERE p.id_publicacion=i.id_publicacion AND i.id_usuario IS NULL',target_schema,target_schema);
 EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS imagen_publicacion_object_path ON %I.imagen_publicacion(bucket,object_path) WHERE object_path IS NOT NULL',target_schema);
 EXECUTE format('GRANT SELECT,INSERT,UPDATE,DELETE ON %I.imagen_publicacion TO sql_listado_applications',target_schema);
 EXECUTE format('GRANT UPDATE(version_imagenes) ON %I.publicacion TO sql_listado_applications',target_schema);
END $$;
CREATE TABLE IF NOT EXISTS listado_applications.publication_image_operation (
 id_usuario bigint NOT NULL,
 operation_key uuid NOT NULL,
 fingerprint char(64) NOT NULL,
 id_publicacion bigint,
 base_version bigint NOT NULL,
 plan jsonb NOT NULL,
 estado text NOT NULL DEFAULT 'Prepared' CHECK(estado IN ('Prepared','Complete','Cleaned')),
 touched_at timestamptz NOT NULL DEFAULT clock_timestamp(),
 PRIMARY KEY(id_usuario,operation_key)
);
CREATE TABLE IF NOT EXISTS listado_applications.publication_image_cleanup (
 object_path text PRIMARY KEY,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS publication_image_operation_recovery ON listado_applications.publication_image_operation(touched_at) WHERE estado='Prepared';
GRANT SELECT,INSERT,UPDATE,DELETE ON listado_applications.publication_image_operation,listado_applications.publication_image_cleanup TO sql_listado_applications;
REVOKE ALL ON listado_applications.publication_image_operation,listado_applications.publication_image_cleanup FROM PUBLIC;
ALTER TABLE listado_applications.publication_image_operation ENABLE ROW LEVEL SECURITY;
ALTER TABLE listado_applications.publication_image_cleanup ENABLE ROW LEVEL SECURITY;
DO $$ DECLARE name text; BEGIN
 FOREACH name IN ARRAY ARRAY['publication_image_operation','publication_image_cleanup'] LOOP
  IF NOT EXISTS(SELECT FROM pg_policies WHERE schemaname='listado_applications' AND tablename=name AND policyname='runtime_role_access') THEN
   EXECUTE format('CREATE POLICY runtime_role_access ON listado_applications.%I TO sql_listado_applications USING(true) WITH CHECK(true)',name);
  END IF;
 END LOOP;
END $$;
COMMIT;
