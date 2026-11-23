BEGIN;

ALTER TABLE convivencia_mensajeria.outbox DROP CONSTRAINT outbox_accion_check;
ALTER TABLE convivencia_mensajeria.outbox ADD CONSTRAINT outbox_accion_check
  CHECK (accion IN ('Confirmar','Liberar'));

DROP TABLE convivencia_mensajeria.expulsion;
DROP TABLE convivencia_mensajeria.tarea;

ALTER TABLE convivencia_mensajeria.pertenencia
  DROP CONSTRAINT pertenencia_retiro_consistente,
  DROP COLUMN salida_en,
  DROP COLUMN id_retirado_por,
  DROP COLUMN motivo_retiro;

ALTER TABLE convivencia_mensajeria.arriendo
  DROP COLUMN id_arrendador,
  DROP COLUMN id_responsable,
  DROP COLUMN estado,
  DROP COLUMN version_ocupacion;

COMMIT;
