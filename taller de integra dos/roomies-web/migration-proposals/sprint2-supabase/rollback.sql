-- PROPUESTA de reversión estructural conservadora. Nueva aprobación necesaria.
-- Detener todos los escritores y respaldar el estado POSTERIOR al cutover primero.
-- Una transacción. Conserva columnas añadidas, UUID, postulaciones y notificaciones.
DO $$ BEGIN
 IF current_setting('roomies.rollback_approved',true) IS DISTINCT FROM 'sprint2-reviewed' THEN
  RAISE EXCEPTION 'Falta aprobación explícita de reversión';
 END IF;
 IF EXISTS(SELECT FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='haycupo' AND c.relname IN ('usuario','publicacion','imagen_publicacion','conexion') AND c.relkind<>'v') THEN
  RAISE EXCEPTION 'Drift detectado: no borrar objetos heredados';
 END IF;
END $$;
SET LOCAL lock_timeout='5s';
LOCK TABLE auth_users.usuario,listado_applications.publicacion,listado_applications.imagen_publicacion,match_conexion.conexion IN ACCESS EXCLUSIVE MODE;
ALTER ROLE sql_auth_users NOLOGIN;
ALTER ROLE sql_listado_applications NOLOGIN;
ALTER ROLE sql_match_conexion NOLOGIN;
-- DROP solo de nuestras vistas de compatibilidad, sin CASCADE y sin borrar filas.
DROP VIEW haycupo.usuario;
DROP VIEW haycupo.publicacion;
DROP VIEW haycupo.imagen_publicacion;
DROP VIEW haycupo.conexion;
ALTER TABLE auth_users.usuario SET SCHEMA haycupo;
ALTER TABLE listado_applications.publicacion SET SCHEMA haycupo;
ALTER TABLE listado_applications.imagen_publicacion SET SCHEMA haycupo;
ALTER TABLE match_conexion.conexion SET SCHEMA haycupo;
-- No desactivar RLS ni restaurar permisos públicos de manera automática.
-- Cerrar previamente conexiones activas: NOLOGIN no expulsa sesiones existentes.
-- Las tablas nuevas se conservan privadas. El login anterior NO reconoce cuentas
-- creadas únicamente con Supabase Auth: nunca generarles una contraseña heredada.
