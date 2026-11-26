-- Solo lectura. Ejecutar en el SQL Editor del proyecto de PRUEBAS
-- erefnpvdjondjpcyjrpb antes de elegir/aplicar migraciones.
-- No consulta contraseñas, JWT, emails ni contenido de usuarios.
BEGIN READ ONLY;
SELECT current_database() AS database_name, current_user AS executor,
       current_setting('server_version') AS postgres_version;

SELECT name AS required_schema, EXISTS (
  SELECT 1 FROM pg_namespace n WHERE n.nspname=name
) AS present
FROM (VALUES ('haycupo'),('auth_users'),('listado_applications'),
             ('convivencia_mensajeria')) AS required(name);

SELECT table_name AS required_table,
       to_regclass('convivencia_mensajeria.' || table_name) IS NOT NULL AS present
FROM (VALUES ('arriendo'),('pertenencia'),('incorporacion'),('outbox'),
             ('conversacion'),('mensaje'),('tarea')) AS required(table_name);

SELECT r.rolname, r.rolcanlogin, r.rolinherit, r.rolsuper, r.rolbypassrls,
       r.rolcreatedb, r.rolcreaterole, r.rolreplication
FROM pg_roles r
WHERE r.rolname IN ('sql_auth_users','sql_listado_applications','sql_convivencia_mensajeria');

SELECT table_name,column_name,data_type,is_nullable
FROM information_schema.columns
WHERE table_schema='convivencia_mensajeria'
  AND table_name IN ('arriendo','pertenencia','tarea')
ORDER BY table_name,ordinal_position;

SELECT trigger_name,event_object_table,action_timing,event_manipulation
FROM information_schema.triggers
WHERE event_object_schema='convivencia_mensajeria'
ORDER BY event_object_table,trigger_name;
COMMIT;
