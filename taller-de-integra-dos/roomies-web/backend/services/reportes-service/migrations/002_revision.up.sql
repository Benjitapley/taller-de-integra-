BEGIN;
SET LOCAL lock_timeout = '5s';

CREATE INDEX reporte_fecha ON reportes.reporte(fecha DESC,id_reporte DESC);

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

REVOKE ALL ON reportes.reporte_historial,reportes.outbox FROM PUBLIC;
ALTER TABLE reportes.reporte_historial ENABLE ROW LEVEL SECURITY;
ALTER TABLE reportes.outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY historial_runtime ON reportes.reporte_historial TO sql_reportes USING (true) WITH CHECK (true);
CREATE POLICY outbox_runtime ON reportes.outbox TO sql_reportes USING (true) WITH CHECK (true);
GRANT UPDATE(estado) ON reportes.reporte TO sql_reportes;
GRANT SELECT ON reportes.reporte_historial,reportes.outbox TO sql_reportes;
GRANT INSERT(id_reporte,id_administrador,estado_anterior,estado_nuevo,nota_interna)
    ON reportes.reporte_historial TO sql_reportes;
GRANT USAGE ON SEQUENCE reportes.reporte_historial_id_actuacion_seq TO sql_reportes;
GRANT INSERT(id_actuacion),UPDATE(proximo_intento,entregado_en) ON reportes.outbox TO sql_reportes;
COMMIT;
