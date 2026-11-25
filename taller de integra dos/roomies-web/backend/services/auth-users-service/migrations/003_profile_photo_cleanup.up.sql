BEGIN;
CREATE TABLE IF NOT EXISTS auth_users.limpieza_foto (
    objeto text PRIMARY KEY CHECK (objeto ~ '^[0-9a-f-]{36}/[0-9a-f]{32}\.(jpg|png|webp)$'),
    disponible timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE auth_users.limpieza_foto ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON auth_users.limpieza_foto FROM PUBLIC;
GRANT SELECT, INSERT, UPDATE, DELETE ON auth_users.limpieza_foto TO sql_auth_users;
DROP POLICY IF EXISTS limpieza_foto_runtime ON auth_users.limpieza_foto;
CREATE POLICY limpieza_foto_runtime ON auth_users.limpieza_foto TO sql_auth_users USING (true) WITH CHECK (true);
COMMIT;
