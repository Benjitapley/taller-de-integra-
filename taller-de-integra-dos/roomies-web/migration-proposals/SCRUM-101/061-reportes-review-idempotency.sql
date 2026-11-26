\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
\ir checks/reportes-prior.sql
SELECT pg_catalog.pg_advisory_xact_lock(101, 11);
SET LOCAL scrum101.reportes_stage = '60';
\ir checks/reportes-catalog.sql
SET LOCAL ROLE scrum101_owner;
CREATE TABLE reportes.reporte_historial (
    id_actuacion BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    id_reporte BIGINT NOT NULL REFERENCES reportes.reporte(id_reporte),
    id_administrador BIGINT NOT NULL CHECK (id_administrador > 0),
    estado_anterior TEXT NOT NULL,
    estado_nuevo TEXT NOT NULL,
    nota_interna TEXT CHECK (char_length(btrim(nota_interna)) BETWEEN 1 AND 1000),
    fecha TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    CHECK ((estado_anterior = 'Pendiente' AND estado_nuevo IN ('En_Revision','Descartado'))
        OR (estado_anterior = 'En_Revision' AND estado_nuevo IN ('Resuelto','Descartado')))
);
CREATE INDEX reporte_historial_orden ON reportes.reporte_historial(id_reporte,id_actuacion);

CREATE TABLE reportes.outbox (
    id_actuacion BIGINT PRIMARY KEY REFERENCES reportes.reporte_historial(id_actuacion),
    proximo_intento TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    entregado_en TIMESTAMPTZ
);
CREATE INDEX reporte_outbox_pendiente ON reportes.outbox(proximo_intento,id_actuacion) WHERE entregado_en IS NULL;

CREATE TABLE reportes.operacion_envio (
    id_denunciante BIGINT NOT NULL CHECK (id_denunciante > 0),
    clave VARCHAR(80) NOT NULL CHECK (clave ~ '^[A-Za-z0-9:_-]+$'),
    huella CHAR(64) NOT NULL,
    respuesta JSONB NOT NULL,
    creada_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (id_denunciante, clave)
);
REVOKE ALL ON reportes.reporte_historial FROM PUBLIC;
ALTER TABLE reportes.reporte_historial ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON reportes.outbox FROM PUBLIC;
ALTER TABLE reportes.outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON reportes.operacion_envio FROM PUBLIC;
ALTER TABLE reportes.operacion_envio ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON SEQUENCE reportes.reporte_historial_id_actuacion_seq FROM PUBLIC;
RESET ROLE;
SET LOCAL scrum101.reportes_stage = '61';
\ir checks/reportes-catalog.sql
COMMIT;
