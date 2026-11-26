\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
\ir checks/reportes-prior.sql
SELECT pg_catalog.pg_advisory_xact_lock(101, 11);
SET LOCAL scrum101.reportes_stage = '59';
\ir checks/reportes-catalog.sql
SET LOCAL ROLE scrum101_owner;
CREATE SCHEMA reportes;
REVOKE ALL ON SCHEMA reportes FROM PUBLIC;
CREATE TABLE reportes.reporte (
    id_reporte BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_denunciante BIGINT NOT NULL CHECK (id_denunciante > 0),
    id_usuario_reportado BIGINT CHECK (id_usuario_reportado > 0 AND id_usuario_reportado <> id_denunciante),
    id_publicacion_reportada BIGINT CHECK (id_publicacion_reportada > 0),
    tipo TEXT GENERATED ALWAYS AS (
        CASE WHEN id_usuario_reportado IS NULL THEN 'Publicacion' ELSE 'Usuario' END
    ) STORED,
    categoria TEXT NOT NULL CHECK (char_length(btrim(categoria)) BETWEEN 1 AND 80),
    descripcion TEXT NOT NULL CHECK (char_length(btrim(descripcion)) BETWEEN 1 AND 1000),
    estado TEXT NOT NULL DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente','En_Revision','Resuelto','Descartado')),
    fecha TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CHECK (num_nonnulls(id_usuario_reportado,id_publicacion_reportada) = 1)
);
CREATE INDEX reporte_denunciante_fecha ON reportes.reporte(id_denunciante,fecha DESC,id_reporte DESC);
CREATE INDEX reporte_fecha ON reportes.reporte(fecha DESC,id_reporte DESC);
REVOKE ALL ON reportes.reporte FROM PUBLIC;
ALTER TABLE reportes.reporte ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON SEQUENCE reportes.reporte_id_reporte_seq FROM PUBLIC;
RESET ROLE;
SET LOCAL scrum101.reportes_stage = '60';
\ir checks/reportes-catalog.sql
COMMIT;
