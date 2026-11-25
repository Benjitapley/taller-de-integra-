BEGIN;
SET LOCAL lock_timeout = '5s';

ALTER TABLE reportes.reporte
    ADD COLUMN clave_idempotencia UUID,
    ADD CONSTRAINT reporte_denunciante_clave_unica UNIQUE (id_denunciante, clave_idempotencia);
GRANT INSERT(clave_idempotencia) ON reportes.reporte TO sql_reportes;

COMMIT;
