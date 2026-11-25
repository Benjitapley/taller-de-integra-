-- S3R-C02: ejecutar como propietario/migrador, nunca con credenciales de cliente.
BEGIN;
CREATE SCHEMA IF NOT EXISTS listado_applications;
CREATE TABLE IF NOT EXISTS listado_applications.region (
 id_region INTEGER PRIMARY KEY,
 nombre TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS listado_applications.comuna (
 id_comuna INTEGER PRIMARY KEY,
 id_region INTEGER NOT NULL REFERENCES listado_applications.region(id_region),
 nombre TEXT NOT NULL,
 UNIQUE(id_region,id_comuna)
);

DO $$
DECLARE target regclass; invalid_ids text;
BEGIN
 target := COALESCE(to_regclass('listado_applications.publicacion'),to_regclass('haycupo.publicacion'));
 IF target IS NULL THEN RAISE EXCEPTION 'Falta la tabla de publicaciones de B03'; END IF;
 EXECUTE format('SELECT string_agg(id_publicacion::text,'','') FROM %s WHERE precio < 0 OR precio > 999999999999 OR precio <> trunc(precio) OR precio::text IN (''NaN'',''Infinity'',''-Infinity'')',target) INTO invalid_ids;
 IF invalid_ids IS NOT NULL THEN
  RAISE EXCEPTION 'Precios heredados requieren corrección explícita antes de convertir; publicaciones: %',invalid_ids;
 END IF;
 EXECUTE format('ALTER TABLE %s ALTER COLUMN precio TYPE bigint USING precio::bigint',target);
 EXECUTE format('ALTER TABLE %s ADD CONSTRAINT publicacion_precio_clp CHECK (precio BETWEEN 0 AND 999999999999)',target);
 EXECUTE format('ALTER TABLE %s ADD COLUMN id_region integer, ADD COLUMN id_comuna integer, ADD COLUMN reglas jsonb NOT NULL DEFAULT ''[]'', ADD COLUMN ocupacion_confirmada integer, ADD COLUMN version_ocupacion bigint NOT NULL DEFAULT 0',target);
 EXECUTE format('ALTER TABLE %s ADD CONSTRAINT publicacion_comuna_region FOREIGN KEY(id_region,id_comuna) REFERENCES listado_applications.comuna(id_region,id_comuna), ADD CONSTRAINT publicacion_ubicacion_completa CHECK ((id_region IS NULL)=(id_comuna IS NULL)), ADD CONSTRAINT publicacion_ocupacion CHECK (ocupacion_confirmada BETWEEN 0 AND cupos_totales), ADD CONSTRAINT publicacion_version_ocupacion CHECK (version_ocupacion>=0)',target);
 -- No se deducen región/comuna ni ocupación de texto o capacidad heredada.
 -- NULL identifica filas que B03/Convivencia todavía deben conciliar.
END $$;
REVOKE ALL ON listado_applications.region,listado_applications.comuna FROM PUBLIC;
GRANT USAGE ON SCHEMA listado_applications TO sql_listado_applications;
GRANT SELECT ON listado_applications.region,listado_applications.comuna TO sql_listado_applications;
COMMIT;
