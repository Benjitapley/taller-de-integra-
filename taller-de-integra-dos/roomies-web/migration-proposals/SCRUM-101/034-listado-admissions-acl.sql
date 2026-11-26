\set ON_ERROR_STOP on
BEGIN;
SELECT pg_catalog.pg_advisory_xact_lock(101, 10);
\ir checks/target.sql
\ir checks/provisioned.sql
\ir checks/auth-base.sql
\ir checks/auth-shape.sql
\ir checks/auth-permissions.sql
SET LOCAL scrum101.listado_stage = '034';
\ir checks/listado-base.sql
SET LOCAL ROLE scrum101_owner;

-- Derivado de Listado 004. ACL definitivas en esta misma transacción.
ALTER TABLE listado_applications.publicacion ADD COLUMN version_capacidad bigint NOT NULL DEFAULT 1 CHECK (version_capacidad > 0);
ALTER TABLE listado_applications.postulacion ADD COLUMN id_arriendo bigint CHECK(id_arriendo>0);
CREATE TABLE listado_applications.admision_operacion (
 id_operacion uuid PRIMARY KEY,
 id_actor bigint NOT NULL,
 id_postulacion bigint NOT NULL REFERENCES listado_applications.postulacion(id_postulacion),
 id_publicacion bigint NOT NULL,
 id_usuario bigint NOT NULL,
 version_capacidad bigint NOT NULL CHECK(version_capacidad>0),
 solicitud jsonb NOT NULL,
 estado text NOT NULL DEFAULT 'Pendiente' CHECK(estado IN ('Pendiente','Confirmada','Rechazada')),
 codigo_error text,
 http_status integer,
 respuesta jsonb,
 resultado jsonb,
 creado_en timestamptz NOT NULL DEFAULT clock_timestamp(),
 ultimo_intento timestamptz
);
CREATE UNIQUE INDEX admision_postulacion_vigente ON listado_applications.admision_operacion(id_postulacion) WHERE estado IN ('Pendiente','Confirmada');
CREATE INDEX admision_recuperacion ON listado_applications.admision_operacion(ultimo_intento NULLS FIRST,creado_en) WHERE estado='Pendiente';
CREATE INDEX admision_publicacion ON listado_applications.admision_operacion(id_publicacion,estado);
CREATE TABLE listado_applications.admision_reserva (
 id_operacion uuid PRIMARY KEY REFERENCES listado_applications.admision_operacion(id_operacion),
 estado text NOT NULL DEFAULT 'Reservada' CHECK(estado IN ('Reservada','Confirmada','Liberada')),
 id_arriendo bigint CHECK(id_arriendo>0),
 proyeccion jsonb
);

GRANT USAGE ON SCHEMA listado_applications TO sql_listado_applications;
GRANT USAGE ON SEQUENCE listado_applications.publicacion_id_publicacion_seq,
    listado_applications.imagen_publicacion_id_imagen_seq, listado_applications.postulacion_id_postulacion_seq
    TO sql_listado_applications;

ALTER TABLE listado_applications.publicacion ENABLE ROW LEVEL SECURITY;
GRANT SELECT (id_publicacion, id_usuario, tipo, titulo, descripcion, contenido, precio, ubicacion, estado, cupos_totales, categoria, tipo_vivienda, mascota, permitir_comentarios, fecha_publicacion, id_region, id_comuna, reglas, ocupacion_confirmada, version_ocupacion, version_imagenes, version_capacidad) ON listado_applications.publicacion TO sql_listado_applications;
CREATE POLICY runtime_select ON listado_applications.publicacion FOR SELECT
    TO sql_listado_applications USING (true);
GRANT INSERT (id_usuario, tipo, titulo, descripcion, precio, ubicacion, cupos_totales, categoria, tipo_vivienda, mascota, permitir_comentarios, id_region, id_comuna, reglas, ocupacion_confirmada, version_ocupacion) ON listado_applications.publicacion TO sql_listado_applications;
CREATE POLICY runtime_insert ON listado_applications.publicacion FOR INSERT
    TO sql_listado_applications WITH CHECK (true);
GRANT UPDATE (tipo, titulo, descripcion, precio, ubicacion, estado, cupos_totales, categoria, tipo_vivienda, mascota, permitir_comentarios, id_region, id_comuna, reglas, ocupacion_confirmada, version_ocupacion, version_imagenes, version_capacidad) ON listado_applications.publicacion TO sql_listado_applications;
CREATE POLICY runtime_update ON listado_applications.publicacion FOR UPDATE
    TO sql_listado_applications USING (true) WITH CHECK (true);

ALTER TABLE listado_applications.imagen_publicacion ENABLE ROW LEVEL SECURITY;
GRANT SELECT (id_imagen, id_publicacion, url, orden, id_usuario, bucket, object_path, mime, size_bytes) ON listado_applications.imagen_publicacion TO sql_listado_applications;
CREATE POLICY runtime_select ON listado_applications.imagen_publicacion FOR SELECT
    TO sql_listado_applications USING (true);
GRANT INSERT (id_publicacion, url, orden, id_usuario, bucket, object_path, mime, size_bytes) ON listado_applications.imagen_publicacion TO sql_listado_applications;
CREATE POLICY runtime_insert ON listado_applications.imagen_publicacion FOR INSERT
    TO sql_listado_applications WITH CHECK (true);
GRANT UPDATE (orden) ON listado_applications.imagen_publicacion TO sql_listado_applications;
CREATE POLICY runtime_update ON listado_applications.imagen_publicacion FOR UPDATE
    TO sql_listado_applications USING (true) WITH CHECK (true);
GRANT DELETE ON listado_applications.imagen_publicacion TO sql_listado_applications;
CREATE POLICY runtime_delete ON listado_applications.imagen_publicacion FOR DELETE
    TO sql_listado_applications USING (true);

ALTER TABLE listado_applications.postulacion ENABLE ROW LEVEL SECURITY;
GRANT SELECT (id_postulacion, id_publicacion, id_usuario, estado, motivo, fecha_postulacion, actualizada_en, id_arriendo) ON listado_applications.postulacion TO sql_listado_applications;
CREATE POLICY runtime_select ON listado_applications.postulacion FOR SELECT
    TO sql_listado_applications USING (true);
GRANT INSERT (id_publicacion, id_usuario) ON listado_applications.postulacion TO sql_listado_applications;
CREATE POLICY runtime_insert ON listado_applications.postulacion FOR INSERT
    TO sql_listado_applications WITH CHECK (true);
GRANT UPDATE (estado, motivo, actualizada_en, id_arriendo) ON listado_applications.postulacion TO sql_listado_applications;
CREATE POLICY runtime_update ON listado_applications.postulacion FOR UPDATE
    TO sql_listado_applications USING (true) WITH CHECK (true);

ALTER TABLE listado_applications.outbox ENABLE ROW LEVEL SECURITY;
GRANT SELECT (event_key, id_usuario, referencia_id, estado, enviado) ON listado_applications.outbox TO sql_listado_applications;
CREATE POLICY runtime_select ON listado_applications.outbox FOR SELECT
    TO sql_listado_applications USING (true);
GRANT INSERT (event_key, id_usuario, referencia_id, estado) ON listado_applications.outbox TO sql_listado_applications;
CREATE POLICY runtime_insert ON listado_applications.outbox FOR INSERT
    TO sql_listado_applications WITH CHECK (true);
GRANT UPDATE (enviado) ON listado_applications.outbox TO sql_listado_applications;
CREATE POLICY runtime_update ON listado_applications.outbox FOR UPDATE
    TO sql_listado_applications USING (true) WITH CHECK (true);

ALTER TABLE listado_applications.region ENABLE ROW LEVEL SECURITY;
GRANT SELECT (id_region, nombre) ON listado_applications.region TO sql_listado_applications;
CREATE POLICY runtime_select ON listado_applications.region FOR SELECT
    TO sql_listado_applications USING (true);

ALTER TABLE listado_applications.comuna ENABLE ROW LEVEL SECURITY;
GRANT SELECT (id_comuna, id_region, nombre) ON listado_applications.comuna TO sql_listado_applications;
CREATE POLICY runtime_select ON listado_applications.comuna FOR SELECT
    TO sql_listado_applications USING (true);

ALTER TABLE listado_applications.publication_image_operation ENABLE ROW LEVEL SECURITY;
GRANT SELECT (id_usuario, operation_key, fingerprint, id_publicacion, base_version, plan, estado, touched_at) ON listado_applications.publication_image_operation TO sql_listado_applications;
CREATE POLICY runtime_select ON listado_applications.publication_image_operation FOR SELECT
    TO sql_listado_applications USING (true);
GRANT INSERT (id_usuario, operation_key, fingerprint, id_publicacion, base_version, plan) ON listado_applications.publication_image_operation TO sql_listado_applications;
CREATE POLICY runtime_insert ON listado_applications.publication_image_operation FOR INSERT
    TO sql_listado_applications WITH CHECK (true);
GRANT UPDATE (estado, id_publicacion, touched_at) ON listado_applications.publication_image_operation TO sql_listado_applications;
CREATE POLICY runtime_update ON listado_applications.publication_image_operation FOR UPDATE
    TO sql_listado_applications USING (true) WITH CHECK (true);

ALTER TABLE listado_applications.publication_image_cleanup ENABLE ROW LEVEL SECURITY;
GRANT SELECT (object_path, created_at) ON listado_applications.publication_image_cleanup TO sql_listado_applications;
CREATE POLICY runtime_select ON listado_applications.publication_image_cleanup FOR SELECT
    TO sql_listado_applications USING (true);
GRANT INSERT (object_path) ON listado_applications.publication_image_cleanup TO sql_listado_applications;
CREATE POLICY runtime_insert ON listado_applications.publication_image_cleanup FOR INSERT
    TO sql_listado_applications WITH CHECK (true);
GRANT DELETE ON listado_applications.publication_image_cleanup TO sql_listado_applications;
CREATE POLICY runtime_delete ON listado_applications.publication_image_cleanup FOR DELETE
    TO sql_listado_applications USING (true);

ALTER TABLE listado_applications.admision_operacion ENABLE ROW LEVEL SECURITY;
GRANT SELECT (id_operacion, id_actor, id_postulacion, id_publicacion, id_usuario, version_capacidad, solicitud, estado, codigo_error, http_status, respuesta, resultado, creado_en, ultimo_intento) ON listado_applications.admision_operacion TO sql_listado_applications;
CREATE POLICY runtime_select ON listado_applications.admision_operacion FOR SELECT
    TO sql_listado_applications USING (true);
GRANT INSERT (id_operacion, id_actor, id_postulacion, id_publicacion, id_usuario, version_capacidad, solicitud) ON listado_applications.admision_operacion TO sql_listado_applications;
CREATE POLICY runtime_insert ON listado_applications.admision_operacion FOR INSERT
    TO sql_listado_applications WITH CHECK (true);
GRANT UPDATE (estado, codigo_error, http_status, respuesta, resultado, ultimo_intento) ON listado_applications.admision_operacion TO sql_listado_applications;
CREATE POLICY runtime_update ON listado_applications.admision_operacion FOR UPDATE
    TO sql_listado_applications USING (true) WITH CHECK (true);

ALTER TABLE listado_applications.admision_reserva ENABLE ROW LEVEL SECURITY;
GRANT SELECT (id_operacion, estado, id_arriendo, proyeccion) ON listado_applications.admision_reserva TO sql_listado_applications;
CREATE POLICY runtime_select ON listado_applications.admision_reserva FOR SELECT
    TO sql_listado_applications USING (true);
GRANT INSERT (id_operacion) ON listado_applications.admision_reserva TO sql_listado_applications;
CREATE POLICY runtime_insert ON listado_applications.admision_reserva FOR INSERT
    TO sql_listado_applications WITH CHECK (true);
GRANT UPDATE (estado, id_arriendo, proyeccion) ON listado_applications.admision_reserva TO sql_listado_applications;
CREATE POLICY runtime_update ON listado_applications.admision_reserva FOR UPDATE
    TO sql_listado_applications USING (true) WITH CHECK (true);

RESET ROLE;
\ir checks/listado-shape.sql
\ir checks/listado-cut.sql
\ir checks/listado-permissions.sql
COMMIT;
