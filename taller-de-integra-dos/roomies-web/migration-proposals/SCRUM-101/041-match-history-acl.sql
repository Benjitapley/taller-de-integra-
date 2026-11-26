\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
SELECT pg_catalog.pg_advisory_xact_lock(101, 10);
\ir checks/target.sql
\ir checks/provisioned.sql
\ir checks/auth-base.sql
\ir checks/auth-shape.sql
\ir checks/auth-permissions.sql
\ir checks/listado-shape.sql
\ir checks/listado-cut.sql
\ir checks/listado-permissions.sql
SET LOCAL scrum101.match_stage = '041';
\ir checks/match-base.sql
SET LOCAL ROLE scrum101_owner;

-- Destino fijo derivado de 001_relacion_aceptada.up.sql.
LOCK TABLE match_conexion.conexion IN SHARE ROW EXCLUSIVE MODE;
CREATE TABLE match_conexion.relacion_aceptada (
    usuario_menor bigint NOT NULL CHECK (usuario_menor > 0),
    usuario_mayor bigint NOT NULL CHECK (usuario_mayor > usuario_menor),
    PRIMARY KEY (usuario_menor, usuario_mayor)
);
ALTER TABLE match_conexion.relacion_aceptada ENABLE ROW LEVEL SECURITY;

CREATE FUNCTION match_conexion.registrar_relacion_aceptada() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $trigger$
BEGIN
    IF NEW.estado = 'Aceptada' AND NEW."id_solicitante_FK" > 0 AND NEW."id_receptor_FK" > 0
       AND NEW."id_solicitante_FK" <> NEW."id_receptor_FK" THEN
        INSERT INTO match_conexion.relacion_aceptada (usuario_menor, usuario_mayor)
        VALUES (LEAST(NEW."id_solicitante_FK", NEW."id_receptor_FK"),
                GREATEST(NEW."id_solicitante_FK", NEW."id_receptor_FK"))
        ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
END;
$trigger$;
REVOKE ALL ON FUNCTION match_conexion.registrar_relacion_aceptada() FROM PUBLIC, sql_match_conexion;
CREATE TRIGGER guardar_relacion_aceptada AFTER INSERT OR UPDATE ON match_conexion.conexion
    FOR EACH ROW EXECUTE FUNCTION match_conexion.registrar_relacion_aceptada();

INSERT INTO match_conexion.relacion_aceptada (usuario_menor, usuario_mayor)
SELECT LEAST("id_solicitante_FK","id_receptor_FK"), GREATEST("id_solicitante_FK","id_receptor_FK")
FROM match_conexion.conexion WHERE estado = 'Aceptada' AND "id_solicitante_FK" > 0
    AND "id_receptor_FK" > 0 AND "id_solicitante_FK" <> "id_receptor_FK"
ON CONFLICT DO NOTHING;

GRANT USAGE ON SCHEMA match_conexion TO sql_match_conexion;
GRANT USAGE ON SEQUENCE match_conexion.conexion_id_conexion_seq TO sql_match_conexion;
GRANT SELECT (id_conexion, "id_solicitante_FK", "id_receptor_FK", estado, fecha_solicitud),
    INSERT ("id_solicitante_FK", "id_receptor_FK"), UPDATE (estado), DELETE
    ON match_conexion.conexion TO sql_match_conexion;
GRANT SELECT (usuario_menor, usuario_mayor) ON match_conexion.relacion_aceptada TO sql_match_conexion;

CREATE POLICY runtime_select ON match_conexion.conexion FOR SELECT TO sql_match_conexion USING (true);
CREATE POLICY runtime_insert ON match_conexion.conexion FOR INSERT TO sql_match_conexion WITH CHECK (true);
CREATE POLICY runtime_update ON match_conexion.conexion FOR UPDATE TO sql_match_conexion USING (true) WITH CHECK (true);
CREATE POLICY runtime_delete ON match_conexion.conexion FOR DELETE TO sql_match_conexion USING (true);
CREATE POLICY lectura_match ON match_conexion.relacion_aceptada FOR SELECT TO sql_match_conexion USING (true);

RESET ROLE;
SET LOCAL scrum101.match_stage = 'verify';
\ir checks/match-base.sql
\ir checks/match-shape.sql
\ir checks/match-permissions.sql
COMMIT;
