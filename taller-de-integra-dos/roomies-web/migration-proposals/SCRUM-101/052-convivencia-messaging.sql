\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
\ir checks/target.sql
\ir checks/provisioned.sql
\ir checks/auth-base.sql
\ir checks/auth-shape.sql
\ir checks/auth-permissions.sql
\ir checks/listado-shape.sql
\ir checks/listado-cut.sql
\ir checks/listado-permissions.sql
SET LOCAL scrum101.match_stage = 'verify';
\ir checks/match-base.sql
\ir checks/match-shape.sql
\ir checks/match-permissions.sql
\ir checks/convivencia-target.sql
SELECT pg_catalog.pg_advisory_xact_lock(101, 10);
SET LOCAL scrum101.convivencia_stage = '2';
\ir checks/convivencia-shape.sql
SET LOCAL ROLE scrum101_owner;

LOCK TABLE convivencia_mensajeria.arriendo IN SHARE ROW EXCLUSIVE MODE;
CREATE TABLE convivencia_mensajeria.conversacion (
  id_conversacion BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_arriendo BIGINT NOT NULL UNIQUE REFERENCES convivencia_mensajeria.arriendo(id_arriendo),
  creada_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE convivencia_mensajeria.mensaje (
  id_mensaje BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_conversacion BIGINT NOT NULL REFERENCES convivencia_mensajeria.conversacion(id_conversacion),
  id_remitente BIGINT NOT NULL CHECK (id_remitente > 0),
  nombre_remitente TEXT NOT NULL CHECK (length(btrim(nombre_remitente)) BETWEEN 1 AND 200),
  contenido VARCHAR(2000) NOT NULL CHECK (length(btrim(contenido)) BETWEEN 1 AND 2000),
  id_cliente UUID NOT NULL,
  fecha_envio TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  UNIQUE(id_conversacion,id_remitente,id_cliente)
);
CREATE INDEX mensajes_historial ON convivencia_mensajeria.mensaje(id_conversacion,id_mensaje DESC);

INSERT INTO convivencia_mensajeria.conversacion(id_arriendo)
SELECT id_arriendo FROM convivencia_mensajeria.arriendo
ON CONFLICT(id_arriendo) DO NOTHING;

REVOKE ALL ON convivencia_mensajeria.conversacion,convivencia_mensajeria.mensaje FROM PUBLIC;

RESET ROLE;
SET LOCAL scrum101.convivencia_stage = '3';
\ir checks/convivencia-shape.sql
COMMIT;
