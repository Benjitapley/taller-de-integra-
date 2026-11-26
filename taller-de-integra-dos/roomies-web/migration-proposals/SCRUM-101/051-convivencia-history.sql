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
SET LOCAL scrum101.convivencia_stage = '1';
\ir checks/convivencia-shape.sql
SET LOCAL ROLE scrum101_owner;

LOCK TABLE convivencia_mensajeria.arriendo, convivencia_mensajeria.pertenencia IN SHARE ROW EXCLUSIVE MODE;
ALTER TABLE convivencia_mensajeria.pertenencia ADD COLUMN terminada_en TIMESTAMPTZ;
ALTER TABLE convivencia_mensajeria.pertenencia ADD CONSTRAINT pertenencia_intervalo_valido
    CHECK (terminada_en IS NULL OR (estado = 'Inactiva' AND terminada_en >= creada_en));
CREATE INDEX pertenencia_relacion ON convivencia_mensajeria.pertenencia(id_usuario,id_arriendo);

CREATE FUNCTION convivencia_mensajeria.registrar_fin_pertenencia() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, pg_temp AS $$
BEGIN
    IF OLD.estado = 'Activa' AND NEW.estado = 'Inactiva' THEN
        NEW.terminada_en := COALESCE(NEW.terminada_en, clock_timestamp());
    END IF;
    RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION convivencia_mensajeria.registrar_fin_pertenencia() FROM PUBLIC;
CREATE TRIGGER registrar_fin_pertenencia BEFORE UPDATE OF estado ON convivencia_mensajeria.pertenencia
    FOR EACH ROW EXECUTE FUNCTION convivencia_mensajeria.registrar_fin_pertenencia();

ALTER TABLE convivencia_mensajeria.arriendo ADD COLUMN version_ocupacion BIGINT NOT NULL DEFAULT 0 CHECK(version_ocupacion>=0);
UPDATE convivencia_mensajeria.arriendo a SET version_ocupacion=(SELECT count(*) FROM convivencia_mensajeria.pertenencia p WHERE p.id_arriendo=a.id_arriendo)
WHERE version_ocupacion=0;

RESET ROLE;
SET LOCAL scrum101.convivencia_stage = '2';
\ir checks/convivencia-shape.sql
COMMIT;
