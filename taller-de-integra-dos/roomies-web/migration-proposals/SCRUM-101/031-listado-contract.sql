\set ON_ERROR_STOP on
BEGIN;
SELECT pg_catalog.pg_advisory_xact_lock(101, 10);
\ir checks/target.sql
\ir checks/provisioned.sql
\ir checks/auth-base.sql
\ir checks/auth-shape.sql
\ir checks/auth-permissions.sql
SET LOCAL scrum101.listado_stage = '031';
\ir checks/listado-base.sql
SET LOCAL ROLE scrum101_owner;

-- Derivado de Listado 001, con destino privado fijo.
CREATE TABLE listado_applications.region (
 id_region INTEGER PRIMARY KEY,
 nombre TEXT NOT NULL
);
CREATE TABLE listado_applications.comuna (
 id_comuna INTEGER PRIMARY KEY,
 id_region INTEGER NOT NULL REFERENCES listado_applications.region(id_region),
 nombre TEXT NOT NULL,
 UNIQUE(id_region,id_comuna)
);

DO $prices$
BEGIN
    IF EXISTS (SELECT FROM listado_applications.publicacion
               WHERE precio::text IN ('NaN','Infinity','-Infinity')
                  OR precio < 0 OR precio > 999999999999 OR precio <> trunc(precio)) THEN
        RAISE EXCEPTION 'SCRUM-101: precios requieren conciliación explícita';
    END IF;
END;
$prices$;
ALTER TABLE listado_applications.publicacion
    ALTER COLUMN precio TYPE bigint USING precio::bigint,
    ADD COLUMN id_region integer,
    ADD COLUMN id_comuna integer,
    ADD COLUMN reglas jsonb NOT NULL DEFAULT '[]',
    ADD COLUMN ocupacion_confirmada integer,
    ADD COLUMN version_ocupacion bigint NOT NULL DEFAULT 0,
    ADD CONSTRAINT publicacion_precio_clp CHECK (precio BETWEEN 0 AND 999999999999),
    ADD CONSTRAINT publicacion_comuna_region FOREIGN KEY (id_region,id_comuna)
        REFERENCES listado_applications.comuna (id_region,id_comuna),
    ADD CONSTRAINT publicacion_ubicacion_completa CHECK ((id_region IS NULL) = (id_comuna IS NULL)),
    ADD CONSTRAINT publicacion_ocupacion CHECK (ocupacion_confirmada BETWEEN 0 AND cupos_totales),
    ADD CONSTRAINT publicacion_version_ocupacion CHECK (version_ocupacion >= 0);

RESET ROLE;
COMMIT;
