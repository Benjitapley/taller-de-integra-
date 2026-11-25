-- Proyección monotónica propia de Convivencia; no consulta otros dominios.
BEGIN;
ALTER TABLE convivencia_mensajeria.arriendo ADD COLUMN IF NOT EXISTS version_ocupacion BIGINT NOT NULL DEFAULT 0 CHECK(version_ocupacion>=0);
UPDATE convivencia_mensajeria.arriendo a SET version_ocupacion=(SELECT count(*) FROM convivencia_mensajeria.pertenencia p WHERE p.id_arriendo=a.id_arriendo)
WHERE version_ocupacion=0;
GRANT UPDATE(version_ocupacion) ON convivencia_mensajeria.arriendo TO sql_convivencia_mensajeria;
COMMIT;
