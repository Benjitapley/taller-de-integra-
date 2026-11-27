-- E05: inspeccion de solo lectura sobre el destino de TEST seleccionado.
-- No aplica migraciones ni consulta credenciales o contenido de usuarios.
-- La presencia de objetos acredita prerrequisitos, no la ejecucion exacta
-- de un archivo: contrastar tambien con el historial del migrador.
BEGIN READ ONLY;
SELECT current_database() AS database_name, current_user AS executor,
       current_setting('server_version') AS postgres_version;

SELECT name AS required_object, to_regclass(name) IS NOT NULL AS present
FROM (VALUES
 ('convivencia_mensajeria.arriendo'),
 ('convivencia_mensajeria.pertenencia'),
 ('convivencia_mensajeria.incorporacion'),
 ('convivencia_mensajeria.outbox'),
 ('convivencia_mensajeria.conversacion'),
 ('convivencia_mensajeria.mensaje'),
 ('convivencia_mensajeria.mensajes'),
 ('convivencia_mensajeria.tarea'),
 ('convivencia_mensajeria.retiro'),
 ('convivencia_mensajeria.retiro_outbox'),
 ('convivencia_mensajeria.expulsion'),
 ('convivencia_mensajeria.expulsion_outbox'),
 ('supabase_migrations.schema_migrations')
) AS required(name);

SELECT table_name, column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_schema='convivencia_mensajeria'
  AND table_name IN ('arriendo','pertenencia','tarea','retiro','retiro_outbox',
                     'expulsion','expulsion_outbox')
ORDER BY table_name, ordinal_position;

SELECT r.rolname, r.rolcanlogin, r.rolinherit, r.rolsuper, r.rolbypassrls,
       r.rolcreatedb, r.rolcreaterole, r.rolreplication
FROM pg_roles r
WHERE r.rolname IN ('sql_auth_users','sql_listado_applications',
                   'sql_convivencia_mensajeria');

SELECT c.relname, c.relkind,
       has_table_privilege(r.oid,c.oid,'SELECT') AS can_select,
       has_table_privilege(r.oid,c.oid,'INSERT') AS can_insert,
       has_table_privilege(r.oid,c.oid,'DELETE') AS can_delete
FROM pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
CROSS JOIN pg_roles r
WHERE n.nspname='convivencia_mensajeria'
  AND r.rolname='sql_convivencia_mensajeria'
  AND c.relname IN ('arriendo','pertenencia','tarea','retiro','retiro_outbox',
                   'expulsion','expulsion_outbox')
ORDER BY c.relname;

SELECT table_name, column_name, privilege_type
FROM information_schema.column_privileges
WHERE table_schema='convivencia_mensajeria'
  AND grantee='sql_convivencia_mensajeria'
  AND privilege_type='UPDATE'
ORDER BY table_name, column_name;

SELECT c.relname AS table_name, con.conname,
       pg_get_constraintdef(con.oid) AS definition
FROM pg_constraint con
JOIN pg_class c ON c.oid=con.conrelid
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='convivencia_mensajeria'
  AND c.relname IN ('arriendo','pertenencia','tarea','retiro','retiro_outbox',
                   'expulsion','expulsion_outbox')
ORDER BY c.relname, con.conname;

SELECT event_object_table, trigger_name, action_timing, event_manipulation
FROM information_schema.triggers
WHERE event_object_schema='convivencia_mensajeria'
ORDER BY event_object_table, trigger_name;
COMMIT;
