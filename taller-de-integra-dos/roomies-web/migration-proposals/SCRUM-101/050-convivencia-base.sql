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
SET LOCAL scrum101.convivencia_stage = '0';
\ir checks/convivencia-shape.sql
SET LOCAL ROLE scrum101_owner;

CREATE SCHEMA convivencia_mensajeria;
REVOKE ALL ON SCHEMA convivencia_mensajeria FROM PUBLIC;

CREATE TABLE convivencia_mensajeria.incorporacion (
  id_operacion UUID PRIMARY KEY,
  payload JSONB NOT NULL CHECK (jsonb_typeof(payload)='object'),
  etapa TEXT NOT NULL DEFAULT 'ValidarIdentidad' CHECK (etapa IN ('ValidarIdentidad','Reservar')),
  estado TEXT NOT NULL DEFAULT 'Pendiente' CHECK (estado IN ('Pendiente','Terminada','Rechazada')),
  http_status SMALLINT,
  respuesta JSONB,
  creada_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
  ultimo_intento TIMESTAMPTZ,
  CHECK ((estado='Pendiente' AND http_status IS NULL AND respuesta IS NULL)
    OR (estado='Terminada' AND http_status IS NOT NULL AND http_status=201 AND respuesta IS NOT NULL)
    OR (estado='Rechazada' AND http_status IS NOT NULL AND http_status BETWEEN 400 AND 499 AND respuesta IS NOT NULL))
);

CREATE TABLE convivencia_mensajeria.arriendo (
  id_arriendo BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_publicacion BIGINT NOT NULL UNIQUE CHECK (id_publicacion>0),
  cupos_totales BIGINT NOT NULL CHECK (cupos_totales>0),
  version_capacidad BIGINT NOT NULL CHECK (version_capacidad>0),
  creado_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);

CREATE TABLE convivencia_mensajeria.pertenencia (
  id_pertenencia BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_arriendo BIGINT NOT NULL REFERENCES convivencia_mensajeria.arriendo(id_arriendo),
  id_usuario BIGINT NOT NULL CHECK (id_usuario>0),
  id_postulacion BIGINT NOT NULL UNIQUE CHECK (id_postulacion>0),
  id_operacion UUID NOT NULL UNIQUE REFERENCES convivencia_mensajeria.incorporacion(id_operacion),
  estado TEXT NOT NULL DEFAULT 'Activa' CHECK (estado IN ('Activa','Inactiva')),
  creada_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX una_pertenencia_activa_por_usuario
  ON convivencia_mensajeria.pertenencia(id_usuario) WHERE estado='Activa';
CREATE INDEX pertenencia_ocupacion ON convivencia_mensajeria.pertenencia(id_arriendo) WHERE estado='Activa';
CREATE INDEX incorporaciones_pendientes ON convivencia_mensajeria.incorporacion(ultimo_intento NULLS FIRST,creada_en) WHERE estado='Pendiente';

CREATE TABLE convivencia_mensajeria.outbox (
  id_outbox BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  id_operacion UUID NOT NULL REFERENCES convivencia_mensajeria.incorporacion(id_operacion),
  accion TEXT NOT NULL CHECK (accion IN ('Confirmar','Liberar')),
  reserva JSONB NOT NULL CHECK (jsonb_typeof(reserva)='object'),
  enviado BOOLEAN NOT NULL DEFAULT false,
  ultimo_intento TIMESTAMPTZ,
  UNIQUE(id_operacion,accion)
);
CREATE INDEX outbox_pendiente ON convivencia_mensajeria.outbox(ultimo_intento NULLS FIRST,id_outbox) WHERE NOT enviado;

CREATE FUNCTION convivencia_mensajeria.validar_cupo() RETURNS trigger
LANGUAGE plpgsql SET search_path=pg_catalog,convivencia_mensajeria AS $$
DECLARE capacidad BIGINT; ocupados BIGINT;
BEGIN
  IF NEW.estado='Activa' THEN
    SELECT cupos_totales INTO capacidad FROM convivencia_mensajeria.arriendo
      WHERE id_arriendo=NEW.id_arriendo FOR UPDATE;
    SELECT count(*) INTO ocupados FROM convivencia_mensajeria.pertenencia
      WHERE id_arriendo=NEW.id_arriendo AND estado='Activa'
      AND id_pertenencia<>NEW.id_pertenencia;
    IF ocupados>=capacidad THEN
      RAISE EXCEPTION 'Capacidad agotada' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER pertenencia_capacidad BEFORE INSERT OR UPDATE ON convivencia_mensajeria.pertenencia
  FOR EACH ROW EXECUTE FUNCTION convivencia_mensajeria.validar_cupo();

REVOKE ALL ON ALL TABLES IN SCHEMA convivencia_mensajeria FROM PUBLIC;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA convivencia_mensajeria FROM PUBLIC;
REVOKE ALL ON FUNCTION convivencia_mensajeria.validar_cupo() FROM PUBLIC;

RESET ROLE;
SET LOCAL scrum101.convivencia_stage = '1';
\ir checks/convivencia-shape.sql
COMMIT;
