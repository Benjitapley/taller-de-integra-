-- V2. SOLO LECTURA. Validado solo en PostgreSQL desechable, nunca en Supabase.
-- No muestra passwords, códigos ni JWT.
-- Antes de un preflight autorizado puede fijarse haycupo.jwt_backend_role
-- al nombre de un rol EXISTENTE propuesto. No se crean roles ni credenciales.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30s';

SELECT current_user AS rol_inspector, current_setting('server_version') AS version_postgresql,
       nullif(current_setting('haycupo.jwt_backend_role', true), '') AS rol_backend_propuesto;
SELECT table_name, column_name, data_type, udt_schema, udt_name, is_nullable,
       is_identity, identity_generation, character_maximum_length,
       CASE WHEN column_name = 'id_usuario' THEN column_default END AS generacion_id
FROM information_schema.columns
WHERE table_schema = 'haycupo' AND table_name IN
    ('usuario','publicacion','imagen_publicacion','conexion','codigo_verificacion','sesion_jwt')
ORDER BY table_name, ordinal_position;

SELECT c.relname AS tabla, c.relkind, pg_get_userbyid(c.relowner) AS propietario,
       c.relrowsecurity, c.relforcerowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'haycupo' AND c.relkind IN ('r','p') ORDER BY c.relname;
SELECT con.conrelid::regclass AS tabla, con.conname, con.contype, con.convalidated,
       con.condeferrable, pg_get_constraintdef(con.oid, true) AS definicion
FROM pg_constraint con
WHERE con.conrelid IN (SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace WHERE n.nspname = 'haycupo')
   OR con.confrelid = to_regclass('haycupo.usuario')
ORDER BY con.conrelid::regclass::text, con.conname;
SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'haycupo'
ORDER BY tablename, indexname;

-- Requisitos de INSERT que el backend no podría satisfacer automáticamente.
SELECT a.attname AS campo_obligatorio_no_enviado
FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
WHERE a.attrelid = to_regclass('haycupo.usuario') AND a.attnum > 0 AND NOT a.attisdropped
  AND a.attnotnull AND a.attidentity = '' AND a.attgenerated = '' AND d.adbin IS NULL
  AND a.attname NOT IN ('id_usuario','nombre','correo','contrasena','fecha_nacimiento','verificado');

-- Guardar este resultado antes y después en una ventana sin escrituras.
SELECT (SELECT count(*) FROM haycupo.usuario) AS usuarios,
       (SELECT count(*) FROM haycupo.publicacion) AS publicaciones,
       (SELECT count(*) FROM haycupo.imagen_publicacion) AS imagenes,
       (SELECT count(*) FROM haycupo.conexion) AS conexiones;
SELECT count(*) FILTER (WHERE id_usuario IS NULL) AS ids_nulos,
       count(*) - count(DISTINCT id_usuario) AS ids_nulos_o_repetidos,
       count(*) FILTER (WHERE id_usuario::text !~ '^[1-9][0-9]*$') AS ids_no_positivos_o_no_enteros,
       count(*) FILTER (WHERE correo IS NULL OR btrim(correo::text) = '') AS correos_ausentes
FROM haycupo.usuario;
SELECT count(*) AS grupos_correo_duplicado_normalizado FROM (
    SELECT lower(btrim(correo::text)) FROM haycupo.usuario
    WHERE correo IS NOT NULL AND btrim(correo::text) <> ''
    GROUP BY lower(btrim(correo::text)) HAVING count(*) > 1
) duplicados;
-- Prefijo Argon2 no demuestra que el hash sea válido. No revelar valores.
SELECT count(*) FILTER (WHERE contrasena IS NULL OR contrasena::text = '') AS credenciales_ausentes,
       count(*) FILTER (WHERE contrasena::text ~ '^\$argon2(id|i|d)\$') AS prefijo_argon2,
       count(*) FILTER (WHERE contrasena IS NOT NULL AND contrasena::text <> ''
                        AND contrasena::text !~ '^\$argon2(id|i|d)\$') AS formato_por_revisar
FROM haycupo.usuario;

-- RLS existente no se modifica: sus políticas deben admitir el SQL del backend.
SELECT tablename, policyname, roles, cmd, permissive, qual, with_check
FROM pg_policies WHERE schemaname = 'haycupo' ORDER BY tablename, policyname;
SELECT event_object_table, trigger_name, event_manipulation, action_timing
FROM information_schema.triggers WHERE event_object_schema = 'haycupo';
SELECT grantee, table_name, privilege_type, is_grantable
FROM information_schema.table_privileges WHERE table_schema = 'haycupo'
ORDER BY table_name, grantee, privilege_type;
SELECT grantee, table_name, column_name, privilege_type
FROM information_schema.column_privileges
WHERE table_schema = 'haycupo' AND table_name = 'usuario'
  AND column_name IN ('contrasena','correo','verificado')
ORDER BY grantee, column_name, privilege_type;
SELECT pg_get_userbyid(d.defaclrole) AS propietario,
       CASE WHEN d.defaclnamespace = 0 THEN '(global)' ELSE n.nspname END AS esquema,
       d.defaclobjtype, d.defaclacl
FROM pg_default_acl d LEFT JOIN pg_namespace n ON n.oid = d.defaclnamespace
WHERE d.defaclnamespace = 0 OR n.nspname = 'haycupo';

-- Rol propuesto: cero filas significa que falta parámetro o no existe ese rol.
SELECT r.rolname, r.rolcanlogin, r.rolsuper, r.rolbypassrls, r.rolinherit,
       has_schema_privilege(r.oid, 'haycupo', 'USAGE') AS uso_esquema,
       pg_has_role(r.rolname, current_user, 'USAGE') AS hereda_rol_inspector
FROM pg_roles r WHERE r.rolname = nullif(current_setting('haycupo.jwt_backend_role', true), '');
SELECT member_role.rolname AS miembro, granted_role.rolname AS rol_otorgado, m.admin_option
FROM pg_auth_members m JOIN pg_roles member_role ON member_role.oid = m.member
JOIN pg_roles granted_role ON granted_role.oid = m.roleid
ORDER BY member_role.rolname, granted_role.rolname;
WITH app AS (SELECT oid FROM pg_roles WHERE rolname = nullif(current_setting('haycupo.jwt_backend_role', true), ''))
SELECT c.relname, has_table_privilege(app.oid,c.oid,'SELECT') AS lectura,
       has_table_privilege(app.oid,c.oid,'INSERT') AS alta,
       has_table_privilege(app.oid,c.oid,'UPDATE') AS edicion,
       has_table_privilege(app.oid,c.oid,'DELETE') AS borrado
FROM app CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'haycupo' AND c.relname IN
    ('usuario','publicacion','imagen_publicacion','conexion','codigo_verificacion','sesion_jwt');
WITH app AS (SELECT oid FROM pg_roles WHERE rolname = nullif(current_setting('haycupo.jwt_backend_role', true), ''))
SELECT c.relname AS secuencia, has_sequence_privilege(app.oid,c.oid,'USAGE') AS uso_secuencia
FROM app CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'haycupo' AND c.relkind = 'S';

-- Extensiones/collations y funciones SECURITY DEFINER requieren revisión.
SELECT a.attname, a.atttypid::regtype AS tipo, a.attcollation::regcollation AS collation
FROM pg_attribute a WHERE a.attrelid = to_regclass('haycupo.usuario')
  AND a.attname IN ('correo','contrasena') AND NOT a.attisdropped;
SELECT p.oid::regprocedure AS funcion, pg_get_userbyid(p.proowner) AS propietario,
       p.prosecdef AS security_definer
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'haycupo' AND p.prosecdef;
COMMIT;
