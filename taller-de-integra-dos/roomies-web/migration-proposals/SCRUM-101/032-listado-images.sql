\set ON_ERROR_STOP on
BEGIN;
SELECT pg_catalog.pg_advisory_xact_lock(101, 10);
\ir checks/target.sql
\ir checks/provisioned.sql
\ir checks/auth-base.sql
\ir checks/auth-shape.sql
\ir checks/auth-permissions.sql
SET LOCAL scrum101.listado_stage = '032';
\ir checks/listado-base.sql
SET LOCAL ROLE scrum101_owner;

-- Derivado de Listado 002. Las URL y los bytes externos se conservan.
ALTER TABLE listado_applications.publicacion ADD COLUMN version_imagenes bigint NOT NULL DEFAULT 0;
ALTER TABLE listado_applications.imagen_publicacion
    ADD COLUMN id_usuario bigint,
    ADD COLUMN bucket text,
    ADD COLUMN object_path text,
    ADD COLUMN mime text,
    ADD COLUMN size_bytes bigint;
UPDATE listado_applications.imagen_publicacion AS i
SET id_usuario = p.id_usuario
FROM listado_applications.publicacion AS p
WHERE p.id_publicacion = i.id_publicacion AND i.id_usuario IS NULL;
CREATE UNIQUE INDEX imagen_publicacion_object_path
    ON listado_applications.imagen_publicacion (bucket,object_path) WHERE object_path IS NOT NULL;

CREATE TABLE listado_applications.publication_image_operation (
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
CREATE TABLE listado_applications.publication_image_cleanup (
 object_path text PRIMARY KEY,
 created_at timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX publication_image_operation_recovery ON listado_applications.publication_image_operation(touched_at) WHERE estado='Prepared';

RESET ROLE;
COMMIT;
