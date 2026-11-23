BEGIN;

ALTER TABLE convivencia_mensajeria.arriendo
  ADD COLUMN id_arrendador BIGINT,
  ADD COLUMN id_responsable BIGINT,
  ADD COLUMN estado TEXT NOT NULL DEFAULT 'Activo'
    CHECK (estado IN ('Activo','Finalizado')),
  ADD COLUMN version_ocupacion BIGINT NOT NULL DEFAULT 0;

ALTER TABLE convivencia_mensajeria.pertenencia
  ADD COLUMN salida_en TIMESTAMPTZ,
  ADD COLUMN id_retirado_por BIGINT,
  ADD COLUMN motivo_retiro VARCHAR(1000),
  ADD CONSTRAINT pertenencia_retiro_consistente CHECK (
    (estado='Activa' AND salida_en IS NULL AND id_retirado_por IS NULL AND motivo_retiro IS NULL)
    OR (estado='Inactiva' AND salida_en IS NOT NULL
        AND id_retirado_por IS NOT NULL AND motivo_retiro IS NOT NULL)
  );

CREATE TABLE convivencia_mensajeria.expulsion (
  id_expulsion BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  clave UUID NOT NULL UNIQUE,
  id_arriendo BIGINT NOT NULL REFERENCES convivencia_mensajeria.arriendo(id_arriendo),
  id_usuario BIGINT NOT NULL,
  id_actor BIGINT NOT NULL,
  motivo VARCHAR(1000) NOT NULL CHECK (length(btrim(motivo))>0),
  ejecutada_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE convivencia_mensajeria.tarea (
  id_tarea BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_arriendo BIGINT NOT NULL REFERENCES convivencia_mensajeria.arriendo(id_arriendo),
  id_asignado BIGINT,
  estado TEXT NOT NULL DEFAULT 'Pendiente'
);

ALTER TABLE convivencia_mensajeria.outbox DROP CONSTRAINT outbox_accion_check;
ALTER TABLE convivencia_mensajeria.outbox ADD CONSTRAINT outbox_accion_check
  CHECK (accion IN ('Confirmar','Liberar','Retiro','Cierre'));

GRANT SELECT,INSERT,UPDATE ON convivencia_mensajeria.expulsion,convivencia_mensajeria.tarea
  TO sql_convivencia_mensajeria;
GRANT UPDATE ON convivencia_mensajeria.arriendo,convivencia_mensajeria.pertenencia
  TO sql_convivencia_mensajeria;
GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA convivencia_mensajeria
  TO sql_convivencia_mensajeria;

COMMIT;
