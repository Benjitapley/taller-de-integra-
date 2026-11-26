\set ON_ERROR_STOP on
BEGIN;
\ir ../checks/target.sql
\ir ../checks/provisioned.sql
\ir ../checks/auth-base.sql
\ir ../checks/auth-shape.sql
\ir ../checks/auth-permissions.sql
\ir ../checks/listado-shape.sql
\ir ../checks/listado-cut.sql
\ir ../checks/listado-permissions.sql
SET LOCAL scrum101.match_stage = 'verify';
\ir ../checks/match-base.sql
\ir ../checks/match-shape.sql
\ir ../checks/match-permissions.sql

SET LOCAL ROLE sql_match_conexion;
DO $test$
DECLARE
    created record;
    reversed_id bigint;
    command text;
BEGIN
    IF current_user <> 'sql_match_conexion'
       OR NOT row_security_active('match_conexion.conexion')
       OR NOT row_security_active('match_conexion.relacion_aceptada')
       OR has_schema_privilege(current_user,'match_conexion','CREATE') IS DISTINCT FROM false
       OR has_function_privilege(current_user,'match_conexion.registrar_relacion_aceptada()','EXECUTE') IS DISTINCT FROM false
    THEN RAISE EXCEPTION 'Runtime, RLS o privilegios inesperados'; END IF;

    INSERT INTO match_conexion.conexion ("id_solicitante_FK","id_receptor_FK")
    VALUES (101042,101041) RETURNING * INTO STRICT created;
    IF created.id_conexion <= 0 OR created.estado <> 'Pendiente' OR created.fecha_solicitud IS NULL
    THEN RAISE EXCEPTION 'Defaults inesperados'; END IF;

    BEGIN
        INSERT INTO match_conexion.conexion ("id_solicitante_FK","id_receptor_FK") VALUES (101041,101042);
        RAISE EXCEPTION 'Se permitió un par vigente inverso';
    EXCEPTION WHEN SQLSTATE '23505' THEN NULL;
    END;
    BEGIN
        INSERT INTO match_conexion.conexion ("id_solicitante_FK","id_receptor_FK") VALUES (101043,101043);
        RAISE EXCEPTION 'Se permitió una autorrelación';
    EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
    END;
    BEGIN
        UPDATE match_conexion.conexion SET estado='Inválida' WHERE id_conexion=created.id_conexion;
        RAISE EXCEPTION 'Se permitió un estado fuera del contrato';
    EXCEPTION WHEN SQLSTATE '23514' THEN NULL;
    END;

    PERFORM * FROM match_conexion.conexion
    WHERE "id_receptor_FK"=101041 AND estado='Pendiente' AND id_conexion=created.id_conexion
    ORDER BY fecha_solicitud DESC LIMIT 100 FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'No se obtuvo la solicitud pendiente con bloqueo'; END IF;
    UPDATE match_conexion.conexion SET estado='Aceptada' WHERE id_conexion=created.id_conexion
        RETURNING * INTO STRICT created;
    UPDATE match_conexion.conexion SET estado='Aceptada' WHERE id_conexion=created.id_conexion;
    IF created.estado <> 'Aceptada' OR (SELECT count(*) FROM match_conexion.relacion_aceptada
        WHERE usuario_menor=101041 AND usuario_mayor=101042) <> 1
    THEN RAISE EXCEPTION 'El historial no registró exactamente un par canónico'; END IF;

    DELETE FROM match_conexion.conexion WHERE id_conexion=created.id_conexion RETURNING id_conexion INTO STRICT reversed_id;
    IF reversed_id <> created.id_conexion OR EXISTS (SELECT FROM match_conexion.conexion WHERE id_conexion=reversed_id)
       OR NOT EXISTS (SELECT FROM match_conexion.relacion_aceptada WHERE usuario_menor=101041 AND usuario_mayor=101042)
    THEN RAISE EXCEPTION 'El historial no sobrevivió al borrado'; END IF;

    INSERT INTO match_conexion.conexion ("id_solicitante_FK","id_receptor_FK") VALUES (101044,101045)
        RETURNING id_conexion INTO STRICT reversed_id;
    UPDATE match_conexion.conexion SET estado='Rechazada' WHERE id_conexion=reversed_id;
    INSERT INTO match_conexion.conexion ("id_solicitante_FK","id_receptor_FK") VALUES (101045,101044)
        RETURNING id_conexion INTO STRICT reversed_id;
    IF EXISTS (SELECT FROM match_conexion.relacion_aceptada WHERE usuario_menor=101044 AND usuario_mayor=101045)
    THEN RAISE EXCEPTION 'Una solicitud rechazada o pendiente dejó historial'; END IF;

    FOREACH command IN ARRAY ARRAY[
        'INSERT INTO match_conexion.relacion_aceptada (usuario_menor,usuario_mayor) VALUES (101046,101047)',
        'UPDATE match_conexion.relacion_aceptada SET usuario_mayor=101046 WHERE false',
        'DELETE FROM match_conexion.relacion_aceptada WHERE false',
        'UPDATE match_conexion.conexion SET "id_receptor_FK"=101046 WHERE false',
        'SELECT id_usuario FROM auth_users.usuario WHERE false',
        'SELECT id_publicacion FROM listado_applications.publicacion WHERE false'
    ] LOOP
        BEGIN
            EXECUTE command;
            RAISE EXCEPTION 'Operación prohibida aceptada: %', command;
        EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
        END;
    END LOOP;
END;
$test$;

RESET ROLE;
DO $test$
DECLARE
    principal text;
BEGIN
    FOREACH principal IN ARRAY ARRAY['sql_auth_users','sql_listado_applications','sql_convivencia_mensajeria','sql_reportes'] LOOP
        EXECUTE format('SET LOCAL ROLE %I',principal);
        BEGIN
            PERFORM usuario_menor FROM match_conexion.relacion_aceptada WHERE false;
            RAISE EXCEPTION 'Acceso cruzado aceptado para %', principal;
        EXCEPTION WHEN SQLSTATE '42501' THEN NULL;
        END;
        RESET ROLE;
    END LOOP;
END;
$test$;
ROLLBACK;
