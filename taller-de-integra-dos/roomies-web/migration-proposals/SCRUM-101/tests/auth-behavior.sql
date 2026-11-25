\set ON_ERROR_STOP on
BEGIN;
\ir ../checks/target.sql
\ir ../checks/provisioned.sql
\ir ../checks/auth-base.sql
\ir ../checks/auth-shape.sql
\ir ../checks/auth-permissions.sql
SET LOCAL ROLE sql_auth_users;

DO $test$
DECLARE
    subject_id constant uuid := '10100000-0000-4000-8000-000000000021';
    session_uuid constant uuid := '10100000-0000-4000-8000-000000000022';
    user_id bigint;
    notice_id bigint;
    rejected_sql text;
BEGIN
    INSERT INTO auth_users.usuario (supabase_user_id, nombre, fecha_nacimiento)
    VALUES (subject_id, 'Perfil sintético SCRUM-101', DATE '1990-01-01')
    ON CONFLICT (supabase_user_id) DO NOTHING RETURNING id_usuario INTO STRICT user_id;
    INSERT INTO auth_users.usuario (supabase_user_id, nombre, fecha_nacimiento)
    VALUES (subject_id, 'Reintento', DATE '1990-01-01')
    ON CONFLICT (supabase_user_id) DO NOTHING;
    IF FOUND THEN RAISE EXCEPTION 'Alta de perfil duplicada'; END IF;
    UPDATE auth_users.usuario SET edad=36, ocupacion='Ensayo', presupuesto=100,
        zona_interes='Ensayo', foto_perfil='synthetic/scrum101'
    WHERE supabase_user_id=subject_id;
    PERFORM id_usuario, edad, foto_perfil FROM auth_users.usuario
    WHERE supabase_user_id=subject_id AND edad=36 FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Falta el perfil actualizado'; END IF;

    INSERT INTO auth_users.notificacion (id_usuario,tipo,referencia_id,estado,event_key)
    VALUES (user_id,'reporte_actualizado',1,'recibido','synthetic-scrum101')
    ON CONFLICT (event_key) DO NOTHING RETURNING id INTO STRICT notice_id;
    INSERT INTO auth_users.notificacion (id_usuario,tipo,referencia_id,estado,event_key)
    VALUES (user_id,'reporte_actualizado',1,'recibido','synthetic-scrum101')
    ON CONFLICT (event_key) DO NOTHING;
    IF FOUND THEN RAISE EXCEPTION 'Notificación duplicada'; END IF;

    INSERT INTO auth_users.sesion_revocada (session_id,subject) VALUES (session_uuid,subject_id)
    ON CONFLICT DO NOTHING;
    INSERT INTO auth_users.sesion_revocada (session_id,subject) VALUES (session_uuid,subject_id)
    ON CONFLICT DO NOTHING;
    IF FOUND THEN RAISE EXCEPTION 'Revocación duplicada'; END IF;
    PERFORM 1 FROM auth_users.sesion_revocada WHERE session_id=session_uuid;
    IF NOT FOUND THEN RAISE EXCEPTION 'Falta la revocación'; END IF;

    INSERT INTO auth_users.perfil_comun (supabase_user_id,genero,id_region_interes,id_comuna_interes)
    VALUES (subject_id,'Otro',1,101) ON CONFLICT (supabase_user_id)
    DO UPDATE SET genero=excluded.genero;
    INSERT INTO auth_users.perfil_comun (supabase_user_id,genero)
    VALUES (subject_id,'Prefiero_no_indicarlo') ON CONFLICT (supabase_user_id)
    DO UPDATE SET genero=excluded.genero;
    PERFORM 1 FROM auth_users.perfil_comun WHERE supabase_user_id=subject_id AND genero='Prefiero_no_indicarlo';
    IF NOT FOUND THEN RAISE EXCEPTION 'Falló el upsert de perfil común'; END IF;
    INSERT INTO auth_users.foto_limpieza (reference,subject) VALUES ('synthetic/scrum101',subject_id)
    ON CONFLICT DO NOTHING;
    DELETE FROM auth_users.foto_limpieza WHERE reference='synthetic/scrum101';
    IF NOT FOUND THEN RAISE EXCEPTION 'Falta el elemento de limpieza'; END IF;

    IF has_schema_privilege(current_user, 'auth_users', 'CREATE') IS DISTINCT FROM false THEN
        RAISE EXCEPTION 'El runtime de Auth tiene CREATE sobre auth_users';
    END IF;

    FOREACH rejected_sql IN ARRAY ARRAY[
        'UPDATE auth_users.usuario SET supabase_user_id=NULL WHERE false',
        'UPDATE auth_users.usuario SET id_usuario=0 WHERE false',
        'UPDATE auth_users.usuario SET nombre=''prohibido'' WHERE false',
        'INSERT INTO auth_users.usuario(id_usuario) VALUES (1)',
        'DELETE FROM auth_users.usuario WHERE false',
        'UPDATE auth_users.sesion_revocada SET subject=NULL WHERE false',
        'SELECT subject FROM auth_users.sesion_revocada WHERE false'
    ] LOOP
        BEGIN
            EXECUTE rejected_sql;
            RAISE EXCEPTION 'Operación prohibida aceptada: %', rejected_sql;
        EXCEPTION WHEN insufficient_privilege THEN
            NULL;
        END;
    END LOOP;
END;
$test$;

RESET ROLE;
DO $test$
DECLARE
    principal text;
BEGIN
    FOREACH principal IN ARRAY ARRAY['sql_listado_applications','sql_match_conexion',
        'sql_convivencia_mensajeria','sql_reportes']
    LOOP
        EXECUTE format('SET LOCAL ROLE %I', principal);
        BEGIN
            PERFORM id_usuario FROM auth_users.usuario;
            RAISE EXCEPTION 'Acceso cruzado aceptado para %', principal;
        EXCEPTION WHEN insufficient_privilege THEN
            NULL;
        END;
        RESET ROLE;
    END LOOP;
END;
$test$;
ROLLBACK;
