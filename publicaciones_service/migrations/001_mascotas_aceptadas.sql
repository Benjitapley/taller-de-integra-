-- Ejecutar una vez en PostgreSQL antes de iniciar la aplicación actualizada.
-- Es aditiva: conserva mascota, las publicaciones y sus preferencias existentes.
BEGIN;

ALTER TABLE haycupo.publicacion
    ADD COLUMN IF NOT EXISTS tipos_mascotas_aceptadas VARCHAR(40)[]
        NOT NULL DEFAULT ARRAY[]::VARCHAR(40)[],
    ADD COLUMN IF NOT EXISTS condiciones_mascotas TEXT;

-- Permite volver a ejecutar el script si las columnas ya existían como opcionales.
UPDATE haycupo.publicacion
SET tipos_mascotas_aceptadas = ARRAY[]::VARCHAR(40)[]
WHERE tipos_mascotas_aceptadas IS NULL;

ALTER TABLE haycupo.publicacion
    ALTER COLUMN tipos_mascotas_aceptadas SET DEFAULT ARRAY[]::VARCHAR(40)[],
    ALTER COLUMN tipos_mascotas_aceptadas SET NOT NULL;

COMMIT;
