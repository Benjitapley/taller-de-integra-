-- Respaldo logico de negocio; ejecutar con una conexion administrativa de solo lectura.
-- El resultado contiene datos privados: cifrar fuera del repositorio, nunca guardarlo aqui.
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL timezone='UTC';
SELECT jsonb_build_object(
 'capturedAt',clock_timestamp(),
 'project','erefnpvdjondjpcyjrpb',
 'catalog',jsonb_build_object(
  'tables',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'columns',
    (SELECT jsonb_agg(jsonb_build_object('name',a.attname,'type',format_type(a.atttypid,a.atttypmod),
      'notnull',a.attnotnull,'identity',a.attidentity,'generated',a.attgenerated,'default',pg_get_expr(d.adbin,d.adrelid)) ORDER BY a.attnum)
     FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
     WHERE a.attrelid=c.oid AND a.attnum>0 AND NOT a.attisdropped)))
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='r'
     AND n.nspname IN ('haycupo','auth_users','listado_applications','convivencia_mensajeria','match_conexion')),
  'functions',(SELECT jsonb_agg(pg_get_functiondef(p.oid)) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
    WHERE n.nspname IN ('haycupo','auth_users','listado_applications','convivencia_mensajeria','match_conexion')),
  'views',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',c.relname,'sql',pg_get_viewdef(c.oid)))
    FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE c.relkind='v'
    AND n.nspname IN ('haycupo','auth_users','listado_applications','convivencia_mensajeria','match_conexion'))),
 'metadata',jsonb_build_object(
  'constraints',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'table',c.relname,'name',k.conname,'type',k.contype,'definition',pg_get_constraintdef(k.oid)))
    FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE n.nspname IN ('haycupo','auth_users','listado_applications','convivencia_mensajeria','match_conexion')),
  'indexes',(SELECT jsonb_agg(jsonb_build_object('schema',schemaname,'table',tablename,'name',indexname,'definition',indexdef))
    FROM pg_indexes WHERE schemaname IN ('haycupo','auth_users','listado_applications','convivencia_mensajeria','match_conexion')),
  'triggers',(SELECT jsonb_agg(pg_get_triggerdef(t.oid)) FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
    WHERE NOT t.tgisinternal AND n.nspname IN ('haycupo','auth_users','listado_applications','convivencia_mensajeria','match_conexion')),
  'enums',(SELECT jsonb_agg(jsonb_build_object('schema',n.nspname,'name',t.typname,'labels',
     (SELECT jsonb_agg(enumlabel ORDER BY enumsortorder) FROM pg_enum e WHERE e.enumtypid=t.oid)))
    FROM pg_type t JOIN pg_namespace n ON n.oid=t.typnamespace WHERE t.typtype='e'
    AND n.nspname IN ('public','haycupo','auth_users','listado_applications','convivencia_mensajeria','match_conexion')),
  'sequences',(SELECT jsonb_agg(to_jsonb(s)) FROM pg_sequences s WHERE schemaname IN ('haycupo','auth_users','listado_applications','convivencia_mensajeria','match_conexion'))),
 'permissions',jsonb_build_object(
  'grants',(SELECT jsonb_agg(to_jsonb(g)) FROM information_schema.role_table_grants g
    WHERE grantee IN ('sql_auth_users','sql_listado_applications','sql_convivencia_mensajeria') AND table_schema IN ('haycupo','auth_users','listado_applications','convivencia_mensajeria')),
  'column_grants',(SELECT jsonb_agg(to_jsonb(g)) FROM information_schema.role_column_grants g
    WHERE grantee IN ('sql_auth_users','sql_listado_applications','sql_convivencia_mensajeria') AND table_schema IN ('haycupo','auth_users','listado_applications','convivencia_mensajeria'))),
 'data',(SELECT jsonb_agg(to_jsonb(s)) FROM (
-- Explicit allowlist; provider auth, storage and secrets stay in Supabase.
SELECT 'haycupo.usuario' AS name,count(*)::int AS count,COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) AS rows,md5(COALESCE(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),'')) AS fingerprint FROM haycupo.usuario t
UNION ALL
SELECT 'haycupo.conexion' AS name,count(*)::int AS count,COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) AS rows,md5(COALESCE(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),'')) AS fingerprint FROM haycupo.conexion t
UNION ALL
SELECT 'haycupo.imagen_publicacion' AS name,count(*)::int AS count,COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) AS rows,md5(COALESCE(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),'')) AS fingerprint FROM haycupo.imagen_publicacion t
UNION ALL
SELECT 'haycupo.publicacion' AS name,count(*)::int AS count,COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) AS rows,md5(COALESCE(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),'')) AS fingerprint FROM haycupo.publicacion t
UNION ALL
SELECT 'auth_users.perfil_comun' AS name,count(*)::int AS count,COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) AS rows,md5(COALESCE(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),'')) AS fingerprint FROM auth_users.perfil_comun t
UNION ALL
SELECT 'auth_users.foto_limpieza' AS name,count(*)::int AS count,COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) AS rows,md5(COALESCE(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),'')) AS fingerprint FROM auth_users.foto_limpieza t
UNION ALL
SELECT 'auth_users.notificacion' AS name,count(*)::int AS count,COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) AS rows,md5(COALESCE(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),'')) AS fingerprint FROM auth_users.notificacion t
UNION ALL
SELECT 'auth_users.sesion_revocada' AS name,count(*)::int AS count,COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) AS rows,md5(COALESCE(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),'')) AS fingerprint FROM auth_users.sesion_revocada t
UNION ALL
SELECT 'auth_users.identidad' AS name,count(*)::int AS count,COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) AS rows,md5(COALESCE(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),'')) AS fingerprint FROM auth_users.identidad t
UNION ALL
SELECT 'listado_applications.publicacion_metadata' AS name,count(*)::int AS count,COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) AS rows,md5(COALESCE(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),'')) AS fingerprint FROM listado_applications.publicacion_metadata t
UNION ALL
SELECT 'listado_applications.outbox' AS name,count(*)::int AS count,COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) AS rows,md5(COALESCE(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),'')) AS fingerprint FROM listado_applications.outbox t
UNION ALL
SELECT 'listado_applications.publication_image_operation' AS name,count(*)::int AS count,COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) AS rows,md5(COALESCE(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),'')) AS fingerprint FROM listado_applications.publication_image_operation t
UNION ALL
SELECT 'listado_applications.publication_image_cleanup' AS name,count(*)::int AS count,COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) AS rows,md5(COALESCE(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),'')) AS fingerprint FROM listado_applications.publication_image_cleanup t
UNION ALL
SELECT 'listado_applications.postulacion' AS name,count(*)::int AS count,COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) AS rows,md5(COALESCE(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),'')) AS fingerprint FROM listado_applications.postulacion t
UNION ALL
SELECT 'listado_applications.admision_operacion' AS name,count(*)::int AS count,COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) AS rows,md5(COALESCE(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),'')) AS fingerprint FROM listado_applications.admision_operacion t
UNION ALL
SELECT 'listado_applications.admision_reserva' AS name,count(*)::int AS count,COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) AS rows,md5(COALESCE(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),'')) AS fingerprint FROM listado_applications.admision_reserva t
UNION ALL
SELECT 'listado_applications.region' AS name,count(*)::int AS count,COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) AS rows,md5(COALESCE(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),'')) AS fingerprint FROM listado_applications.region t
UNION ALL
SELECT 'listado_applications.comuna' AS name,count(*)::int AS count,COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) AS rows,md5(COALESCE(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),'')) AS fingerprint FROM listado_applications.comuna t
UNION ALL
SELECT 'convivencia_mensajeria.incorporacion' AS name,count(*)::int AS count,COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) AS rows,md5(COALESCE(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),'')) AS fingerprint FROM convivencia_mensajeria.incorporacion t
UNION ALL
SELECT 'convivencia_mensajeria.outbox' AS name,count(*)::int AS count,COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) AS rows,md5(COALESCE(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),'')) AS fingerprint FROM convivencia_mensajeria.outbox t
UNION ALL
SELECT 'convivencia_mensajeria.pertenencia' AS name,count(*)::int AS count,COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) AS rows,md5(COALESCE(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),'')) AS fingerprint FROM convivencia_mensajeria.pertenencia t
UNION ALL
SELECT 'convivencia_mensajeria.arriendo' AS name,count(*)::int AS count,COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) AS rows,md5(COALESCE(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),'')) AS fingerprint FROM convivencia_mensajeria.arriendo t
UNION ALL
SELECT 'convivencia_mensajeria.conversacion' AS name,count(*)::int AS count,COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) AS rows,md5(COALESCE(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),'')) AS fingerprint FROM convivencia_mensajeria.conversacion t
UNION ALL
SELECT 'convivencia_mensajeria.mensaje' AS name,count(*)::int AS count,COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) AS rows,md5(COALESCE(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),'')) AS fingerprint FROM convivencia_mensajeria.mensaje t
UNION ALL
SELECT 'convivencia_mensajeria.tarea' AS name,count(*)::int AS count,COALESCE(jsonb_agg(to_jsonb(t) ORDER BY to_jsonb(t)::text),'[]'::jsonb) AS rows,md5(COALESCE(string_agg(to_jsonb(t)::text,E'\n' ORDER BY to_jsonb(t)::text),'')) AS fingerprint FROM convivencia_mensajeria.tarea t
 )s)
) AS snapshot;
COMMIT;
