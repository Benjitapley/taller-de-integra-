BEGIN;
ALTER TABLE convivencia_mensajeria.arriendo
  ADD COLUMN finalizado_en TIMESTAMPTZ,
  ADD COLUMN id_responsable BIGINT;
UPDATE convivencia_mensajeria.arriendo a SET id_responsable=(
  SELECT p.id_usuario FROM convivencia_mensajeria.pertenencia p
  WHERE p.id_arriendo=a.id_arriendo ORDER BY p.id_pertenencia LIMIT 1);
UPDATE convivencia_mensajeria.arriendo a SET id_responsable=NULL
WHERE NOT EXISTS (SELECT FROM convivencia_mensajeria.pertenencia p
  WHERE p.id_arriendo=a.id_arriendo AND p.id_usuario=a.id_responsable AND p.estado='Activa');

CREATE TABLE convivencia_mensajeria.tarea (
  id_tarea BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_arriendo BIGINT NOT NULL REFERENCES convivencia_mensajeria.arriendo,
  titulo VARCHAR(120) NOT NULL CHECK(length(btrim(titulo))>0),
  descripcion VARCHAR(1000),
  estado TEXT NOT NULL DEFAULT 'Pendiente' CHECK(estado IN ('Pendiente','Completada')),
  id_creador BIGINT NOT NULL,
  id_asignado BIGINT,
  fecha_creacion TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX tareas_arriendo ON convivencia_mensajeria.tarea(id_arriendo,id_tarea);
CREATE TABLE convivencia_mensajeria.expulsion (
  id_expulsion UUID PRIMARY KEY,
  id_arriendo BIGINT NOT NULL REFERENCES convivencia_mensajeria.arriendo,
  id_usuario BIGINT NOT NULL,
  id_actor BIGINT NOT NULL,
  motivo VARCHAR(500) NOT NULL CHECK(length(btrim(motivo))>0),
  fecha TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(id_arriendo,id_usuario)
);
CREATE TABLE convivencia_mensajeria.retiro_outbox (
  id_expulsion UUID NOT NULL REFERENCES convivencia_mensajeria.expulsion,
  destino TEXT NOT NULL CHECK(destino IN ('Listado','Notificacion')),
  payload JSONB NOT NULL,
  enviado BOOLEAN NOT NULL DEFAULT false,
  ultimo_intento TIMESTAMPTZ,
  PRIMARY KEY(id_expulsion,destino)
);
REVOKE ALL ON convivencia_mensajeria.tarea,convivencia_mensajeria.expulsion,convivencia_mensajeria.retiro_outbox FROM PUBLIC;
GRANT SELECT,INSERT,UPDATE ON convivencia_mensajeria.tarea,convivencia_mensajeria.retiro_outbox TO sql_convivencia_mensajeria;
GRANT SELECT,INSERT ON convivencia_mensajeria.expulsion TO sql_convivencia_mensajeria;
GRANT UPDATE(finalizado_en,id_responsable) ON convivencia_mensajeria.arriendo TO sql_convivencia_mensajeria;
GRANT USAGE,SELECT ON SEQUENCE convivencia_mensajeria.tarea_id_tarea_seq TO sql_convivencia_mensajeria;
COMMIT;
