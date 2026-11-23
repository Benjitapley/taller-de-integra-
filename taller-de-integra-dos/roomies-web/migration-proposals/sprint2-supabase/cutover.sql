-- PROPUESTA, NO EJECUTADA EN SUPABASE. Revisar con TI4 y respaldar antes.
-- Ejecutar íntegra dentro de UNA transacción, con todos los escritores detenidos.
-- El operador autorizado debe fijar LOCAL roomies.cutover_approved='sprint2-reviewed'.
-- ALTER TABLE SET SCHEMA conserva OID, filas, tipos, índices y secuencias propias.
-- No modifica auth.*, no enlaza cuentas y no convierte precio/edad/timestamps.
DO $$ BEGIN
 IF current_setting('roomies.cutover_approved',true) IS DISTINCT FROM 'sprint2-reviewed' THEN
  RAISE EXCEPTION 'Falta aprobación explícita del cutover';
 END IF;
 IF to_regnamespace('auth_users') IS NOT NULL OR to_regnamespace('listado_applications') IS NOT NULL
    OR to_regnamespace('match_conexion') IS NOT NULL THEN
  RAISE EXCEPTION 'Esquemas de destino existentes: revisar drift, no sobrescribir';
 END IF;
 IF EXISTS (SELECT FROM pg_roles WHERE rolname IN ('sql_auth_users','sql_listado_applications','sql_match_conexion')) THEN
  RAISE EXCEPTION 'Roles existentes: revisar permisos antes de continuar';
 END IF;
END $$;
SET LOCAL lock_timeout='5s';
LOCK TABLE haycupo.usuario,haycupo.publicacion,haycupo.imagen_publicacion,haycupo.conexion IN ACCESS EXCLUSIVE MODE;
CREATE ROLE sql_auth_users NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE ROLE sql_listado_applications NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE ROLE sql_match_conexion NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
DO $$ BEGIN
 EXECUTE format('GRANT CONNECT ON DATABASE %I TO sql_auth_users,sql_listado_applications,sql_match_conexion',current_database());
END $$;
CREATE SCHEMA auth_users;
CREATE SCHEMA listado_applications;
CREATE SCHEMA match_conexion;
REVOKE ALL ON SCHEMA auth_users,listado_applications,match_conexion FROM PUBLIC,anon,authenticated,service_role;
ALTER TABLE haycupo.usuario SET SCHEMA auth_users;
ALTER TABLE haycupo.publicacion SET SCHEMA listado_applications;
ALTER TABLE haycupo.imagen_publicacion SET SCHEMA listado_applications;
ALTER TABLE haycupo.conexion SET SCHEMA match_conexion;

ALTER TABLE auth_users.usuario ADD COLUMN supabase_user_id UUID UNIQUE;
-- NULL conserva todas las cuentas antiguas; ninguna queda enlazada por correo.
ALTER TABLE listado_applications.publicacion ADD COLUMN fecha_publicacion TIMESTAMPTZ;
ALTER TABLE listado_applications.publicacion ALTER COLUMN fecha_publicacion SET DEFAULT clock_timestamp();
ALTER TABLE listado_applications.publicacion ALTER COLUMN estado SET DEFAULT 'Disponible';
ALTER TABLE match_conexion.conexion ALTER COLUMN estado SET DEFAULT 'Pendiente';
ALTER TABLE match_conexion.conexion ALTER COLUMN fecha_solicitud SET DEFAULT (clock_timestamp() AT TIME ZONE 'UTC');
ALTER ROLE sql_auth_users SET timezone='UTC';
ALTER ROLE sql_listado_applications SET timezone='UTC';
ALTER ROLE sql_match_conexion SET timezone='UTC';
-- No inventar fecha histórica: solo publicaciones nuevas reciben el DEFAULT.
CREATE INDEX publicacion_feed_v2 ON listado_applications.publicacion(fecha_publicacion DESC NULLS LAST,id_publicacion DESC);
CREATE INDEX publicacion_owner_v2 ON listado_applications.publicacion(id_usuario);
ALTER TABLE listado_applications.imagen_publicacion ADD CONSTRAINT imagen_publicacion_local_fk
 FOREIGN KEY(id_publicacion) REFERENCES listado_applications.publicacion(id_publicacion) NOT VALID;

CREATE TABLE auth_users.notificacion (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 id_usuario INTEGER NOT NULL REFERENCES auth_users.usuario(id_usuario),
 event_key VARCHAR(150) NOT NULL UNIQUE, tipo VARCHAR(50) NOT NULL,
 referencia_id BIGINT NOT NULL, estado VARCHAR(20) NOT NULL,
 creado_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE auth_users.sesion_revocada (
 session_id UUID PRIMARY KEY, subject UUID NOT NULL REFERENCES auth_users.usuario(supabase_user_id),
 revocada_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE listado_applications.postulacion (
 id_postulacion BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 id_publicacion INTEGER NOT NULL REFERENCES listado_applications.publicacion(id_publicacion),
 id_usuario INTEGER NOT NULL,
 estado VARCHAR(20) NOT NULL DEFAULT 'Pendiente'
 CHECK(estado IN ('Pendiente','Preseleccionada','Aceptada','Rechazada','Cancelada')),
 motivo VARCHAR(1000), fecha_postulacion TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 actualizada_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX postulacion_vigente ON listado_applications.postulacion(id_publicacion,id_usuario)
 WHERE estado IN ('Pendiente','Preseleccionada','Aceptada');
CREATE INDEX postulacion_usuario ON listado_applications.postulacion(id_usuario);
CREATE TABLE listado_applications.outbox (
 event_key VARCHAR(150) PRIMARY KEY, id_usuario INTEGER NOT NULL,
 referencia_id BIGINT NOT NULL, estado VARCHAR(20) NOT NULL, enviado BOOLEAN NOT NULL DEFAULT FALSE
);
-- Si el preflight encuentra duplicados, esto falla y revierte toda la transacción.
CREATE UNIQUE INDEX conexion_vigente ON match_conexion.conexion
 (LEAST("id_solicitante_FK","id_receptor_FK"),GREATEST("id_solicitante_FK","id_receptor_FK"))
 WHERE estado IN ('Pendiente','Aceptada');

-- Reservar también IDs referenciados pero inexistentes: un alta nueva no debe
-- heredar por accidente publicaciones/conexiones huérfanas. Nunca reducir secuencia.
DO $$ DECLARE seq regclass; floor_id bigint; BEGIN
 seq := pg_get_serial_sequence('auth_users.usuario','id_usuario')::regclass;
 SELECT GREATEST(COALESCE(pg_sequence_last_value(seq),0),
  COALESCE((SELECT max(id_usuario) FROM auth_users.usuario),0),
  COALESCE((SELECT max(id_usuario) FROM listado_applications.publicacion),0),
  COALESCE((SELECT max("id_solicitante_FK") FROM match_conexion.conexion),0),
  COALESCE((SELECT max("id_receptor_FK") FROM match_conexion.conexion),0)) INTO floor_id;
 IF floor_id>=2147483647 THEN RAISE EXCEPTION 'Sin rango INTEGER disponible: requiere decisión explícita'; END IF;
 IF floor_id>0 THEN PERFORM setval(seq,floor_id,true); END IF;
END $$;

DO $$ DECLARE item record; seq regclass; floor_id bigint; BEGIN
 FOR item IN SELECT * FROM (VALUES
  ('listado_applications.publicacion','id_publicacion'),
  ('listado_applications.imagen_publicacion','id_imagen'),
  ('match_conexion.conexion','id_conexion')) AS x(tab,col) LOOP
  seq := pg_get_serial_sequence(item.tab,item.col)::regclass;
  EXECUTE format('SELECT GREATEST(COALESCE(max(%I),0),COALESCE(pg_sequence_last_value($1),0)) FROM %s',item.col,item.tab) INTO floor_id USING seq;
  IF item.col='id_publicacion' THEN
   floor_id := GREATEST(floor_id,COALESCE((SELECT max(id_publicacion) FROM listado_applications.imagen_publicacion),0));
  END IF;
  IF floor_id>=2147483647 THEN RAISE EXCEPTION 'Sin rango INTEGER disponible'; END IF;
  IF floor_id>0 THEN PERFORM setval(seq,floor_id,true); END IF;
 END LOOP;
END $$;

GRANT USAGE ON SCHEMA auth_users TO sql_auth_users;
GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA auth_users TO sql_auth_users;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA auth_users TO sql_auth_users;
GRANT USAGE ON SCHEMA listado_applications TO sql_listado_applications;
GRANT SELECT,INSERT,UPDATE ON ALL TABLES IN SCHEMA listado_applications TO sql_listado_applications;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA listado_applications TO sql_listado_applications;
GRANT USAGE ON SCHEMA match_conexion TO sql_match_conexion;
GRANT SELECT,INSERT,UPDATE,DELETE ON match_conexion.conexion TO sql_match_conexion;
GRANT USAGE ON ALL SEQUENCES IN SCHEMA match_conexion TO sql_match_conexion;
GRANT USAGE ON TYPE public.estadoconexion TO sql_match_conexion;
GRANT USAGE ON SCHEMA public TO sql_match_conexion;
-- No GRANT a anon/authenticated/service_role, ni roles cruzados ni CREATE de runtime.
DO $$ DECLARE item record; runtime_role text; BEGIN
 FOR item IN SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN
  ('auth_users','listado_applications','match_conexion') LOOP
  runtime_role := CASE item.schemaname WHEN 'auth_users' THEN 'sql_auth_users'
   WHEN 'listado_applications' THEN 'sql_listado_applications' ELSE 'sql_match_conexion' END;
  EXECUTE format('REVOKE ALL ON %I.%I FROM PUBLIC,anon,authenticated,service_role',item.schemaname,item.tablename);
  EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',item.schemaname,item.tablename);
  EXECUTE format('CREATE POLICY runtime_role_access ON %I.%I TO %I USING(true) WITH CHECK(true)',item.schemaname,item.tablename,runtime_role);
 END LOOP;
END $$;
-- La autorización por usuario sigue en FastAPI: SQL directo no establece auth.uid().
-- Mismo nombre heredado, misma tabla y datos detrás; invoker evita bypass de RLS.
CREATE VIEW haycupo.usuario WITH(security_invoker=true) AS SELECT * FROM auth_users.usuario;
CREATE VIEW haycupo.publicacion WITH(security_invoker=true) AS SELECT * FROM listado_applications.publicacion;
CREATE VIEW haycupo.imagen_publicacion WITH(security_invoker=true) AS SELECT * FROM listado_applications.imagen_publicacion;
CREATE VIEW haycupo.conexion WITH(security_invoker=true) AS SELECT * FROM match_conexion.conexion;
REVOKE ALL ON haycupo.usuario,haycupo.publicacion,haycupo.imagen_publicacion,haycupo.conexion FROM PUBLIC,anon,authenticated,service_role;
-- No habilitar LOGIN todavía. Tras aprobar credenciales por servicio, un operador
-- usa \password sql_auth_users (y los otros dos) y ALTER ROLE ... LOGIN.
-- No incorporar contraseñas a este archivo ni usar postgres/service_role en runtime.
