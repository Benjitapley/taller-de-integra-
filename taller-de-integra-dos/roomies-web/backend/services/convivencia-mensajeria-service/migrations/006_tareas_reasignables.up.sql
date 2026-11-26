BEGIN;
-- 005_tareas creates the shared table on the integrated branch.
-- Keep this migration compatible with databases from the earlier task branch.
CREATE TABLE IF NOT EXISTS convivencia_mensajeria.tarea (
 id_tarea BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 id_arriendo BIGINT NOT NULL REFERENCES convivencia_mensajeria.arriendo,
 titulo TEXT NOT NULL CHECK(length(trim(titulo)) BETWEEN 1 AND 120),
 descripcion TEXT CHECK(length(descripcion)<=1000),
 estado TEXT NOT NULL DEFAULT 'Pendiente' CHECK(estado IN ('Pendiente','Completada')),
 id_creador BIGINT NOT NULL, id_asignado BIGINT,
 fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
ALTER TABLE convivencia_mensajeria.tarea ADD COLUMN IF NOT EXISTS fecha_completada TIMESTAMPTZ;
UPDATE convivencia_mensajeria.tarea SET fecha_completada=fecha_creacion
 WHERE estado='Completada' AND fecha_completada IS NULL;
REVOKE UPDATE ON convivencia_mensajeria.tarea FROM sql_convivencia_mensajeria;
GRANT SELECT,INSERT,UPDATE(id_asignado,estado,fecha_completada) ON convivencia_mensajeria.tarea TO sql_convivencia_mensajeria;
GRANT USAGE,SELECT ON SEQUENCE convivencia_mensajeria.tarea_id_tarea_seq TO sql_convivencia_mensajeria;
COMMIT;
