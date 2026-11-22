BEGIN;
SET LOCAL lock_timeout = '5s';
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
COMMIT;
