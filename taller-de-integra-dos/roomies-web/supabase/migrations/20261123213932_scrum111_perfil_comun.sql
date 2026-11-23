-- SCRUM-111: extensiÃ³n propia de Auth/Users, sin alterar columnas heredadas de TI4.
CREATE TABLE auth_users.perfil_comun (
 supabase_user_id uuid PRIMARY KEY,
 genero text CHECK(genero IN ('Hombre','Mujer','Otro','Prefiero_no_indicarlo')),
 id_region_interes integer CHECK(id_region_interes>0),
 id_comuna_interes integer CHECK(id_comuna_interes>0),
 CHECK(id_comuna_interes IS NULL OR id_region_interes IS NOT NULL)
);
REVOKE ALL ON auth_users.perfil_comun FROM PUBLIC,anon,authenticated;
ALTER TABLE auth_users.perfil_comun ENABLE ROW LEVEL SECURITY;
CREATE POLICY auth_runtime_profile ON auth_users.perfil_comun TO sql_auth_users USING(true) WITH CHECK(true);
GRANT SELECT,INSERT,UPDATE ON auth_users.perfil_comun TO sql_auth_users;

CREATE TABLE auth_users.foto_limpieza (
 reference text PRIMARY KEY,
 subject uuid NOT NULL,
 creada_en timestamptz NOT NULL DEFAULT clock_timestamp()
);
REVOKE ALL ON auth_users.foto_limpieza FROM PUBLIC,anon,authenticated;
ALTER TABLE auth_users.foto_limpieza ENABLE ROW LEVEL SECURITY;
CREATE POLICY auth_photo_cleanup ON auth_users.foto_limpieza TO sql_auth_users USING(true) WITH CHECK(true);
GRANT SELECT,INSERT,DELETE ON auth_users.foto_limpieza TO sql_auth_users;
