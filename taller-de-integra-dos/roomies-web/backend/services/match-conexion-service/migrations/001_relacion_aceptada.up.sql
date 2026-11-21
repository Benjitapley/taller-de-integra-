BEGIN;
SET LOCAL lock_timeout = '5s';
CREATE SCHEMA IF NOT EXISTS match_conexion;
CREATE TABLE match_conexion.relacion_aceptada (
    usuario_menor BIGINT NOT NULL CHECK (usuario_menor > 0),
    usuario_mayor BIGINT NOT NULL CHECK (usuario_mayor > usuario_menor),
    PRIMARY KEY (usuario_menor,usuario_mayor)
);
REVOKE ALL ON match_conexion.relacion_aceptada FROM PUBLIC;
ALTER TABLE match_conexion.relacion_aceptada ENABLE ROW LEVEL SECURITY;
CREATE POLICY lectura_match ON match_conexion.relacion_aceptada FOR SELECT TO sql_match_conexion USING (true);
GRANT USAGE ON SCHEMA match_conexion TO sql_match_conexion;
GRANT SELECT ON match_conexion.relacion_aceptada TO sql_match_conexion;

CREATE FUNCTION match_conexion.registrar_relacion_aceptada() RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = pg_catalog, pg_temp AS $$
BEGIN
    IF NEW.estado::text = 'Aceptada' AND NEW."id_solicitante_FK" > 0 AND NEW."id_receptor_FK" > 0
       AND NEW."id_solicitante_FK" <> NEW."id_receptor_FK" THEN
        INSERT INTO match_conexion.relacion_aceptada VALUES (
            LEAST(NEW."id_solicitante_FK", NEW."id_receptor_FK"),
            GREATEST(NEW."id_solicitante_FK", NEW."id_receptor_FK")
        ) ON CONFLICT DO NOTHING;
    END IF;
    RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION match_conexion.registrar_relacion_aceptada() FROM PUBLIC;

DO $$
DECLARE
    conexion regclass;
    tablas integer;
BEGIN
    SELECT count(*), min(c.oid)::regclass INTO tablas, conexion
      FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
      WHERE c.relname='conexion' AND c.relkind IN ('r','p')
        AND n.nspname IN ('haycupo','match_conexion');
    IF tablas <> 1 THEN
        RAISE EXCEPTION 'Debe existir una única tabla operativa de conexiones';
    END IF;
    EXECUTE format('LOCK TABLE %s IN SHARE ROW EXCLUSIVE MODE', conexion);
    EXECUTE format('CREATE TRIGGER guardar_relacion_aceptada AFTER INSERT OR UPDATE ON %s
        FOR EACH ROW EXECUTE FUNCTION match_conexion.registrar_relacion_aceptada()', conexion);
    EXECUTE format('INSERT INTO match_conexion.relacion_aceptada
        SELECT LEAST("id_solicitante_FK","id_receptor_FK"), GREATEST("id_solicitante_FK","id_receptor_FK")
        FROM %s WHERE estado = ''Aceptada'' AND "id_solicitante_FK" > 0 AND "id_receptor_FK" > 0
        AND "id_solicitante_FK" <> "id_receptor_FK" ON CONFLICT DO NOTHING', conexion);
END $$;
COMMIT;
