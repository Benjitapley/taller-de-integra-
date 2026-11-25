\set ON_ERROR_STOP on
BEGIN;
SELECT pg_catalog.pg_advisory_xact_lock(101, 10);
\ir checks/target.sql
\ir checks/provisioned.sql
\ir checks/auth-base.sql
\ir checks/auth-shape.sql
SET LOCAL ROLE scrum101_owner;

GRANT USAGE ON SCHEMA auth_users TO sql_auth_users;
GRANT USAGE ON SEQUENCE auth_users.usuario_id_usuario_seq, auth_users.notificacion_id_seq TO sql_auth_users;

ALTER TABLE auth_users.usuario ENABLE ROW LEVEL SECURITY;
GRANT SELECT (id_usuario, supabase_user_id, nombre, fecha_nacimiento, edad, ocupacion, ciudad, breve_descripcion, sobre_mi, foto_perfil, presupuesto, zona_interes) ON auth_users.usuario TO sql_auth_users;
CREATE POLICY runtime_select ON auth_users.usuario FOR SELECT
    TO sql_auth_users USING (true);
GRANT INSERT (supabase_user_id, nombre, fecha_nacimiento) ON auth_users.usuario TO sql_auth_users;
CREATE POLICY runtime_insert ON auth_users.usuario FOR INSERT
    TO sql_auth_users WITH CHECK (true);
GRANT UPDATE (edad, ocupacion, ciudad, breve_descripcion, sobre_mi, foto_perfil, presupuesto, zona_interes) ON auth_users.usuario TO sql_auth_users;
CREATE POLICY runtime_update ON auth_users.usuario FOR UPDATE
    TO sql_auth_users USING (true) WITH CHECK (true);

ALTER TABLE auth_users.notificacion ENABLE ROW LEVEL SECURITY;
GRANT SELECT (id, id_usuario, tipo, referencia_id, estado, event_key, creado_en) ON auth_users.notificacion TO sql_auth_users;
CREATE POLICY runtime_select ON auth_users.notificacion FOR SELECT
    TO sql_auth_users USING (true);
GRANT INSERT (id_usuario, tipo, referencia_id, estado, event_key) ON auth_users.notificacion TO sql_auth_users;
CREATE POLICY runtime_insert ON auth_users.notificacion FOR INSERT
    TO sql_auth_users WITH CHECK (true);

ALTER TABLE auth_users.sesion_revocada ENABLE ROW LEVEL SECURITY;
GRANT SELECT (session_id) ON auth_users.sesion_revocada TO sql_auth_users;
CREATE POLICY runtime_select ON auth_users.sesion_revocada FOR SELECT
    TO sql_auth_users USING (true);
GRANT INSERT (session_id, subject) ON auth_users.sesion_revocada TO sql_auth_users;
CREATE POLICY runtime_insert ON auth_users.sesion_revocada FOR INSERT
    TO sql_auth_users WITH CHECK (true);

ALTER TABLE auth_users.perfil_comun ENABLE ROW LEVEL SECURITY;
GRANT SELECT (supabase_user_id, genero, id_region_interes, id_comuna_interes) ON auth_users.perfil_comun TO sql_auth_users;
CREATE POLICY runtime_select ON auth_users.perfil_comun FOR SELECT
    TO sql_auth_users USING (true);
GRANT INSERT (supabase_user_id, genero, id_region_interes, id_comuna_interes) ON auth_users.perfil_comun TO sql_auth_users;
CREATE POLICY runtime_insert ON auth_users.perfil_comun FOR INSERT
    TO sql_auth_users WITH CHECK (true);
GRANT UPDATE (genero, id_region_interes, id_comuna_interes) ON auth_users.perfil_comun TO sql_auth_users;
CREATE POLICY runtime_update ON auth_users.perfil_comun FOR UPDATE
    TO sql_auth_users USING (true) WITH CHECK (true);

ALTER TABLE auth_users.foto_limpieza ENABLE ROW LEVEL SECURITY;
GRANT SELECT (reference, subject, creada_en) ON auth_users.foto_limpieza TO sql_auth_users;
CREATE POLICY runtime_select ON auth_users.foto_limpieza FOR SELECT
    TO sql_auth_users USING (true);
GRANT INSERT (reference, subject) ON auth_users.foto_limpieza TO sql_auth_users;
CREATE POLICY runtime_insert ON auth_users.foto_limpieza FOR INSERT
    TO sql_auth_users WITH CHECK (true);
GRANT DELETE ON auth_users.foto_limpieza TO sql_auth_users;
CREATE POLICY runtime_delete ON auth_users.foto_limpieza FOR DELETE
    TO sql_auth_users USING (true);

RESET ROLE;
\ir checks/auth-permissions.sql
COMMIT;
