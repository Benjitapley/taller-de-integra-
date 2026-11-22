-- C03: intención durable y reserva firme, solo datos de Listado.
BEGIN;
DO $$ DECLARE target regclass; BEGIN
 target:=COALESCE(to_regclass('listado_applications.publicacion'),to_regclass('haycupo.publicacion'));
 IF target IS NULL THEN RAISE EXCEPTION 'Falta la publicación de C02'; END IF;
 EXECUTE format('ALTER TABLE %s ADD COLUMN version_capacidad bigint NOT NULL DEFAULT 1 CHECK(version_capacidad>0)',target);
END $$;
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
REVOKE ALL ON listado_applications.admision_operacion,listado_applications.admision_reserva FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE ON listado_applications.admision_operacion,listado_applications.admision_reserva TO sql_listado_applications;
ALTER TABLE listado_applications.admision_operacion ENABLE ROW LEVEL SECURITY;
ALTER TABLE listado_applications.admision_reserva ENABLE ROW LEVEL SECURITY;
CREATE POLICY runtime_role_access ON listado_applications.admision_operacion TO sql_listado_applications USING(true) WITH CHECK(true);
CREATE POLICY runtime_role_access ON listado_applications.admision_reserva TO sql_listado_applications USING(true) WITH CHECK(true);
COMMIT;
