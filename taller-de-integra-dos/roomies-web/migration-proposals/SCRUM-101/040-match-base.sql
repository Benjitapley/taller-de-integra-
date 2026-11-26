\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
SELECT pg_catalog.pg_advisory_xact_lock(101, 10);
\ir checks/target.sql
\ir checks/provisioned.sql
\ir checks/auth-base.sql
\ir checks/auth-shape.sql
\ir checks/auth-permissions.sql
\ir checks/listado-shape.sql
\ir checks/listado-cut.sql
\ir checks/listado-permissions.sql
SET LOCAL scrum101.match_stage = '040';
\ir checks/match-base.sql
SET LOCAL ROLE scrum101_owner;

-- Base privada derivada del bootstrap local. Sin grants de runtime en 040.
CREATE SCHEMA match_conexion;
REVOKE ALL ON SCHEMA match_conexion FROM PUBLIC;
CREATE TABLE match_conexion.conexion (
    id_conexion bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    "id_solicitante_FK" bigint NOT NULL,
    "id_receptor_FK" bigint NOT NULL,
    estado varchar(20) NOT NULL DEFAULT 'Pendiente',
    fecha_solicitud timestamptz NOT NULL DEFAULT clock_timestamp(),
    CONSTRAINT conexion_estado_valido CHECK (estado IN ('Pendiente','Aceptada','Rechazada')),
    CONSTRAINT conexion_participantes_distintos CHECK ("id_solicitante_FK" <> "id_receptor_FK")
);
CREATE UNIQUE INDEX conexion_vigente ON match_conexion.conexion
    (LEAST("id_solicitante_FK","id_receptor_FK"), GREATEST("id_solicitante_FK","id_receptor_FK"))
    WHERE estado IN ('Pendiente','Aceptada');
ALTER TABLE match_conexion.conexion ENABLE ROW LEVEL SECURITY;
RESET ROLE;
SET LOCAL scrum101.match_stage = '041';
\ir checks/match-base.sql
COMMIT;
