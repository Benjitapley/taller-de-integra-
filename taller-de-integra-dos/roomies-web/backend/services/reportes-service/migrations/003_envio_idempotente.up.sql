-- Aditiva: no altera ni elimina los reportes o sus categorías históricas.
BEGIN;
CREATE TABLE reportes.operacion_envio (
    id_denunciante BIGINT NOT NULL CHECK (id_denunciante > 0),
    clave VARCHAR(80) NOT NULL CHECK (clave ~ '^[A-Za-z0-9:_-]+$'),
    huella CHAR(64) NOT NULL,
    respuesta JSONB NOT NULL,
    creada_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
    PRIMARY KEY (id_denunciante, clave)
);
REVOKE ALL ON reportes.operacion_envio FROM PUBLIC;
ALTER TABLE reportes.operacion_envio ENABLE ROW LEVEL SECURITY;
CREATE POLICY reportes_envio_runtime ON reportes.operacion_envio
    TO sql_reportes USING (true) WITH CHECK (true);
GRANT SELECT, INSERT ON reportes.operacion_envio TO sql_reportes;
COMMIT;
