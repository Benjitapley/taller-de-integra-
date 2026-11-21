-- PROPUESTA ADITIVA: NO ejecutar sin aprobación y respaldo restaurado/verificado.
-- Una transacción. No mueve/renombra/recrea tablas ni cambia columnas, tipos,
-- defaults, índices, RLS o permisos actuales de TI4 en haycupo.
-- Configurar LOCAL roomies.stage1_approved='reviewed' y roomies.backup_verified
-- con SHA-256 de un respaldo cuya restauración haya sido verificada.
DO $$ BEGIN
 IF current_setting('roomies.stage1_approved',true) IS DISTINCT FROM 'reviewed'
 OR COALESCE(current_setting('roomies.backup_verified',true),'') !~ '^[a-f0-9]{64}$' THEN
  RAISE EXCEPTION 'Requiere autorización y evidencia de respaldo restaurado';
 END IF;
 IF to_regnamespace('auth_users') IS NOT NULL OR to_regnamespace('listado_applications') IS NOT NULL
 OR EXISTS(SELECT FROM pg_roles WHERE rolname IN ('sql_auth_users','sql_listado_applications','sql_match_conexion')) THEN
  RAISE EXCEPTION 'Destino existente: revisar drift; no sobrescribir';
 END IF;
END $$;
SET LOCAL lock_timeout='1s';
-- Coordinar ventana breve de escritores. SHARE permite SELECT; si hay actividad,
-- aborta con timeout en vez de esperar indefinidamente. No reintentar sin coordinar.
LOCK TABLE haycupo.usuario,haycupo.publicacion,haycupo.imagen_publicacion,haycupo.conexion IN SHARE MODE;
CREATE ROLE sql_auth_users NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE ROLE sql_listado_applications NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE ROLE sql_match_conexion NOLOGIN NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOBYPASSRLS;
CREATE SCHEMA auth_users;
CREATE SCHEMA listado_applications;
REVOKE ALL ON SCHEMA auth_users,listado_applications FROM PUBLIC,anon,authenticated,service_role;
CREATE TABLE auth_users.identidad (
 supabase_user_id UUID PRIMARY KEY,
 id_usuario INTEGER NOT NULL UNIQUE REFERENCES haycupo.usuario(id_usuario),
 creado_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
-- Vacía: no backfill de las tres cuentas Auth ni enlace por correo.
CREATE TABLE auth_users.notificacion (
 id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 id_usuario INTEGER NOT NULL REFERENCES haycupo.usuario(id_usuario),
 event_key VARCHAR(150) NOT NULL UNIQUE,tipo VARCHAR(50) NOT NULL,
 referencia_id BIGINT NOT NULL,estado VARCHAR(20) NOT NULL,
 creado_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE auth_users.sesion_revocada (
 session_id UUID PRIMARY KEY,subject UUID NOT NULL REFERENCES auth_users.identidad(supabase_user_id),
 revocada_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE TABLE listado_applications.publicacion_metadata (
 id_publicacion INTEGER PRIMARY KEY REFERENCES haycupo.publicacion(id_publicacion),
 fecha_publicacion TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
-- Sin backfill de fechas históricas desconocidas.
CREATE TABLE listado_applications.postulacion (
 id_postulacion BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
 id_publicacion INTEGER NOT NULL REFERENCES haycupo.publicacion(id_publicacion),
 id_usuario INTEGER NOT NULL,
 estado VARCHAR(20) NOT NULL DEFAULT 'Pendiente'
 CHECK(estado IN ('Pendiente','Preseleccionada','Aceptada','Rechazada','Cancelada')),
 motivo VARCHAR(1000),fecha_postulacion TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp(),
 actualizada_en TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
);
CREATE UNIQUE INDEX postulacion_vigente ON listado_applications.postulacion(id_publicacion,id_usuario)
 WHERE estado IN ('Pendiente','Preseleccionada','Aceptada');
CREATE INDEX postulacion_usuario ON listado_applications.postulacion(id_usuario);
CREATE TABLE listado_applications.outbox (
 event_key VARCHAR(150) PRIMARY KEY,id_usuario INTEGER NOT NULL,
 referencia_id BIGINT NOT NULL,estado VARCHAR(20) NOT NULL,enviado BOOLEAN NOT NULL DEFAULT FALSE
);

DO $$ DECLARE item record; seq regclass; floor_id bigint; BEGIN
 -- No reciclar IDs ausentes referenciados por registros heredados.
 FOR item IN SELECT * FROM (VALUES ('usuario','id_usuario','sql_auth_users'),
  ('publicacion','id_publicacion','sql_listado_applications'),
  ('imagen_publicacion','id_imagen','sql_listado_applications'),
  ('conexion','id_conexion','sql_match_conexion')) AS x(tab,col,runtime_role) LOOP
  seq:=pg_get_serial_sequence('haycupo.'||item.tab,item.col)::regclass;
  EXECUTE format('SELECT GREATEST(COALESCE(max(%I),0),COALESCE(pg_sequence_last_value($1),0)) FROM haycupo.%I',item.col,item.tab) INTO floor_id USING seq;
  IF item.tab='usuario' THEN
   floor_id:=GREATEST(floor_id,COALESCE((SELECT max(id_usuario) FROM haycupo.publicacion),0),
    COALESCE((SELECT max("id_solicitante_FK") FROM haycupo.conexion),0),COALESCE((SELECT max("id_receptor_FK") FROM haycupo.conexion),0));
  ELSIF item.tab='publicacion' THEN
   floor_id:=GREATEST(floor_id,COALESCE((SELECT max(id_publicacion) FROM haycupo.imagen_publicacion),0));
  END IF;
  IF floor_id>=2147483647 THEN RAISE EXCEPTION 'Rango INTEGER agotado: requiere decisión'; END IF;
  IF floor_id>0 THEN PERFORM setval(seq,floor_id,true); END IF;
  EXECUTE format('GRANT USAGE ON SEQUENCE %s TO %I',seq,item.runtime_role);
 END LOOP;
 EXECUTE format('GRANT CONNECT ON DATABASE %I TO sql_auth_users,sql_listado_applications,sql_match_conexion',current_database());
END $$;
-- setval no es transaccional: un fallo posterior puede dejar saltos de IDs.
-- Nunca bajar secuencias en la reversión: evita reutilizar identificadores.
GRANT USAGE ON SCHEMA haycupo TO sql_auth_users,sql_listado_applications,sql_match_conexion;
GRANT USAGE ON SCHEMA auth_users TO sql_auth_users;
GRANT USAGE ON SCHEMA listado_applications TO sql_listado_applications;
GRANT SELECT(id_usuario,nombre,fecha_nacimiento,ocupacion,ciudad,breve_descripcion,sobre_mi,foto_perfil,presupuesto,zona_interes)
 ON haycupo.usuario TO sql_auth_users;
GRANT INSERT(nombre,fecha_nacimiento) ON haycupo.usuario TO sql_auth_users;
GRANT UPDATE(ocupacion,ciudad,breve_descripcion,sobre_mi,foto_perfil,presupuesto,zona_interes)
 ON haycupo.usuario TO sql_auth_users;
-- El runtime Auth no obtiene permiso para leer ni modificar hashes/correos heredados.
GRANT SELECT ON haycupo.publicacion,haycupo.imagen_publicacion TO sql_listado_applications;
GRANT INSERT(id_usuario,tipo,titulo,descripcion,precio,ubicacion,estado,cupos_totales,categoria,tipo_vivienda,mascota,permitir_comentarios)
 ON haycupo.publicacion TO sql_listado_applications;
GRANT UPDATE(tipo,titulo,descripcion,precio,ubicacion,estado,cupos_totales,categoria,tipo_vivienda,mascota,permitir_comentarios)
 ON haycupo.publicacion TO sql_listado_applications;
GRANT INSERT(id_publicacion,url,orden),UPDATE(url) ON haycupo.imagen_publicacion TO sql_listado_applications;
GRANT SELECT,INSERT,DELETE ON haycupo.conexion TO sql_match_conexion;
GRANT UPDATE(estado) ON haycupo.conexion TO sql_match_conexion;
GRANT USAGE ON SCHEMA public TO sql_match_conexion;
GRANT USAGE ON TYPE public.estadoconexion TO sql_match_conexion;
GRANT SELECT,INSERT ON auth_users.identidad,auth_users.notificacion,auth_users.sesion_revocada TO sql_auth_users;
GRANT USAGE ON SEQUENCE auth_users.notificacion_id_seq TO sql_auth_users;
GRANT SELECT,INSERT ON listado_applications.publicacion_metadata TO sql_listado_applications;
GRANT SELECT,INSERT,UPDATE ON listado_applications.postulacion,listado_applications.outbox TO sql_listado_applications;
GRANT USAGE ON SEQUENCE listado_applications.postulacion_id_postulacion_seq TO sql_listado_applications;
DO $$ DECLARE item record; runtime_role text; BEGIN
 FOR item IN SELECT schemaname,tablename FROM pg_tables WHERE schemaname IN ('auth_users','listado_applications') LOOP
  runtime_role:=CASE item.schemaname WHEN 'auth_users' THEN 'sql_auth_users' ELSE 'sql_listado_applications' END;
  EXECUTE format('REVOKE ALL ON %I.%I FROM PUBLIC,anon,authenticated,service_role',item.schemaname,item.tablename);
  EXECUTE format('ALTER TABLE %I.%I ENABLE ROW LEVEL SECURITY',item.schemaname,item.tablename);
  EXECUTE format('CREATE POLICY runtime_role_access ON %I.%I TO %I USING(true) WITH CHECK(true)',item.schemaname,item.tablename,runtime_role);
 END LOOP;
END $$;
-- FastAPI autoriza al usuario; no se presume auth.uid() en conexiones SQL directas.
-- NO LOGIN hasta aprovisionar contraseñas y aprobar las dos cuentas de prueba.
-- RLS/índices únicos sobre tablas heredadas se coordinan en una etapa separada.
