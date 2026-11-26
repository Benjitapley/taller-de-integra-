BEGIN;
CREATE TABLE convivencia_mensajeria.tarea (
 id_tarea BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 id_arriendo BIGINT NOT NULL REFERENCES convivencia_mensajeria.arriendo,
 titulo TEXT NOT NULL CHECK(length(trim(titulo)) BETWEEN 1 AND 120),
 descripcion TEXT CHECK(length(descripcion)<=1000),
 estado TEXT NOT NULL DEFAULT 'Pendiente' CHECK(estado IN ('Pendiente','Completada')),
 id_creador BIGINT NOT NULL, id_asignado BIGINT,
 fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
GRANT SELECT,INSERT,UPDATE ON convivencia_mensajeria.tarea TO sql_convivencia_mensajeria;
GRANT USAGE,SELECT ON SEQUENCE convivencia_mensajeria.tarea_id_tarea_seq TO sql_convivencia_mensajeria;
COMMIT;
