-- SOLO LECTURA: no devuelve correo, contraseñas, UUID ni datos personales.
SELECT jsonb_build_object(
 'tables',(SELECT jsonb_agg(jsonb_build_object('table',tablename,'owner',tableowner)) FROM pg_tables WHERE schemaname='haycupo'),
 'counts',jsonb_build_object('usuarios',(SELECT count(*) FROM haycupo.usuario),
  'publicaciones',(SELECT count(*) FROM haycupo.publicacion),
  'imagenes',(SELECT count(*) FROM haycupo.imagen_publicacion),
  'conexiones',(SELECT count(*) FROM haycupo.conexion)),
 'orphan_publications',(SELECT count(*) FROM haycupo.publicacion p WHERE p.id_usuario IS NOT NULL AND NOT EXISTS(SELECT FROM haycupo.usuario u WHERE u.id_usuario=p.id_usuario)),
 'orphan_images',(SELECT count(*) FROM haycupo.imagen_publicacion i WHERE i.id_publicacion IS NOT NULL AND NOT EXISTS(SELECT FROM haycupo.publicacion p WHERE p.id_publicacion=i.id_publicacion)),
 'orphan_connections',(SELECT count(*) FROM haycupo.conexion c WHERE NOT EXISTS(SELECT FROM haycupo.usuario u WHERE u.id_usuario=c."id_solicitante_FK") OR NOT EXISTS(SELECT FROM haycupo.usuario u WHERE u.id_usuario=c."id_receptor_FK")),
 'duplicate_active_connections',(SELECT count(*) FROM (SELECT LEAST("id_solicitante_FK","id_receptor_FK"),GREATEST("id_solicitante_FK","id_receptor_FK") FROM haycupo.conexion WHERE estado IN ('Pendiente','Aceptada') GROUP BY 1,2 HAVING count(*)>1)x),
 'birth_missing',(SELECT count(*) FROM haycupo.usuario WHERE fecha_nacimiento IS NULL),
 'roles',(SELECT jsonb_agg(rolname) FROM pg_roles WHERE rolname IN ('sql_auth_users','sql_listado_applications','sql_match_conexion')),
 'target_schemas',(SELECT jsonb_agg(nspname) FROM pg_namespace WHERE nspname IN ('auth_users','listado_applications','match_conexion')),
 'rls',(SELECT jsonb_agg(jsonb_build_object('table',c.relname,'enabled',c.relrowsecurity)) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname='haycupo' AND c.relkind='r')
) AS readiness;
