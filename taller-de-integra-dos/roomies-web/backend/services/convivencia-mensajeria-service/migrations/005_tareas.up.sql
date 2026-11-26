BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE TABLE convivencia_mensajeria.tarea (
  id_tarea BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_arriendo BIGINT NOT NULL REFERENCES convivencia_mensajeria.arriendo(id_arriendo),
  titulo VARCHAR(120) NOT NULL CHECK (length(btrim(titulo)) BETWEEN 1 AND 120),
  descripcion VARCHAR(1000),
  estado VARCHAR(12) NOT NULL DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente','Completada')),
  id_creador BIGINT NOT NULL CHECK (id_creador > 0),
  id_asignado BIGINT CHECK (id_asignado > 0),
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  fecha_completada TIMESTAMPTZ,
  CHECK ((estado = 'Pendiente' AND fecha_completada IS NULL) OR
         (estado = 'Completada' AND fecha_completada IS NOT NULL))
);
CREATE INDEX tareas_arriendo_estado ON convivencia_mensajeria.tarea(id_arriendo,estado,id_tarea DESC);
CREATE INDEX tareas_asignadas_pendientes ON convivencia_mensajeria.tarea(id_arriendo,id_asignado)
  WHERE estado='Pendiente';
REVOKE ALL ON convivencia_mensajeria.tarea FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE(id_asignado,estado,fecha_completada) ON convivencia_mensajeria.tarea TO sql_convivencia_mensajeria;
GRANT USAGE,SELECT ON SEQUENCE convivencia_mensajeria.tarea_id_tarea_seq TO sql_convivencia_mensajeria;

CREATE FUNCTION convivencia_mensajeria.desasignar_tareas_retirado() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $$
BEGIN
  IF OLD.estado = 'Activa' AND NEW.estado = 'Inactiva' THEN
    UPDATE convivencia_mensajeria.tarea SET id_asignado = NULL
      WHERE id_arriendo = NEW.id_arriendo AND id_asignado = NEW.id_usuario AND estado = 'Pendiente';
  END IF;
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION convivencia_mensajeria.desasignar_tareas_retirado() FROM PUBLIC;
CREATE TRIGGER desasignar_tareas_retirado AFTER UPDATE OF estado
  ON convivencia_mensajeria.pertenencia FOR EACH ROW
  EXECUTE FUNCTION convivencia_mensajeria.desasignar_tareas_retirado();
COMMIT;
