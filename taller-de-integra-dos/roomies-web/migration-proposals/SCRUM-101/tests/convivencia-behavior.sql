\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '15s';
SET LOCAL lc_messages = 'C';
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
\ir ../checks/convivencia-target.sql
\ir ../checks/convivencia-permissions.sql

DO $check$
BEGIN
    IF EXISTS (SELECT FROM convivencia_mensajeria.incorporacion)
       OR EXISTS (SELECT FROM convivencia_mensajeria.arriendo)
       OR EXISTS (SELECT FROM convivencia_mensajeria.pertenencia)
       OR EXISTS (SELECT FROM convivencia_mensajeria.outbox)
       OR EXISTS (SELECT FROM convivencia_mensajeria.conversacion)
       OR EXISTS (SELECT FROM convivencia_mensajeria.mensaje) THEN
        RAISE EXCEPTION 'SCRUM-101: ensayo requiere Convivencia vacía';
    END IF;
END;
$check$;

SET LOCAL ROLE sql_convivencia_mensajeria;
DO $test$
DECLARE
    operation constant uuid := '00000000-0000-4000-8000-000000000531';
    second_operation constant uuid := '00000000-0000-4000-8000-000000000532';
    client_id constant uuid := '00000000-0000-4000-8000-000000000533';
    rental bigint;
    chat bigint;
    message bigint;
    selected bigint;
    picked uuid;
    changed bigint;
    rejected_message text;
    rejected_state text;
    noop boolean;
    membership_id bigint;
    prior_state text;
    prior_end timestamptz;
BEGIN
    IF current_user <> 'sql_convivencia_mensajeria'
       OR NOT row_security_active('convivencia_mensajeria.pertenencia') THEN
        RAISE EXCEPTION 'Rol o RLS efectivos incorrectos';
    END IF;
    INSERT INTO convivencia_mensajeria.incorporacion(id_operacion,payload)
        VALUES(operation,'{"synthetic":true}'),(second_operation,'{}');
    INSERT INTO convivencia_mensajeria.incorporacion(id_operacion,payload)
        VALUES(operation,'{"different":true}') ON CONFLICT DO NOTHING;
    IF (SELECT payload FROM convivencia_mensajeria.incorporacion WHERE id_operacion=operation)
        IS DISTINCT FROM '{"synthetic":true}'::jsonb THEN
        RAISE EXCEPTION 'El UUID no conservó el payload';
    END IF;
    WITH pending AS (
        SELECT id_operacion FROM convivencia_mensajeria.incorporacion
        WHERE estado='Pendiente' AND id_operacion=operation FOR UPDATE SKIP LOCKED
    )
    UPDATE convivencia_mensajeria.incorporacion i SET ultimo_intento=clock_timestamp()
    FROM pending p WHERE i.id_operacion=p.id_operacion RETURNING i.id_operacion INTO STRICT picked;
    IF picked <> operation THEN RAISE EXCEPTION 'Selección de pendientes incorrecta'; END IF;
    UPDATE convivencia_mensajeria.incorporacion SET etapa='Reservar' WHERE id_operacion=operation;

    INSERT INTO convivencia_mensajeria.arriendo(id_publicacion,cupos_totales,version_capacidad)
        VALUES(953001,1,1) RETURNING id_arriendo INTO STRICT rental;
    SELECT id_arriendo INTO STRICT selected FROM convivencia_mensajeria.arriendo
        WHERE id_arriendo=rental FOR UPDATE;
    INSERT INTO convivencia_mensajeria.pertenencia(id_arriendo,id_usuario,id_postulacion,id_operacion)
        VALUES(rental,953011,953021,operation) RETURNING id_pertenencia INTO STRICT selected;
    UPDATE convivencia_mensajeria.arriendo SET version_ocupacion=version_ocupacion+1
        WHERE id_arriendo=rental RETURNING version_ocupacion INTO STRICT changed;
    IF changed <> 1 THEN RAISE EXCEPTION 'Versión de ocupación incorrecta'; END IF;
    BEGIN
        INSERT INTO convivencia_mensajeria.pertenencia(id_arriendo,id_usuario,id_postulacion,id_operacion)
            VALUES(rental,953012,953022,second_operation);
        RAISE EXCEPTION 'Se permitió una sobreocupación';
    EXCEPTION WHEN check_violation THEN
        GET STACKED DIAGNOSTICS rejected_message = MESSAGE_TEXT;
        IF rejected_message <> 'Capacidad agotada' THEN RAISE; END IF;
    END;

    INSERT INTO convivencia_mensajeria.outbox(id_operacion,accion,reserva)
        VALUES(operation,'Confirmar','{}') RETURNING id_outbox INTO STRICT selected;
    INSERT INTO convivencia_mensajeria.outbox(id_operacion,accion,reserva)
        VALUES(operation,'Confirmar','{"duplicate":true}') ON CONFLICT(id_operacion,accion) DO NOTHING;
    INSERT INTO convivencia_mensajeria.outbox(id_operacion,accion,reserva)
        VALUES(second_operation,'Liberar','{}');
    SELECT id_outbox INTO STRICT selected FROM convivencia_mensajeria.outbox
        WHERE id_operacion=operation AND NOT enviado FOR UPDATE SKIP LOCKED;
    UPDATE convivencia_mensajeria.outbox SET ultimo_intento=clock_timestamp(),
        reserva='{"confirmacion":true}', enviado=true WHERE id_outbox=selected;
    IF NOT EXISTS (SELECT FROM convivencia_mensajeria.outbox WHERE id_outbox=selected
                   AND enviado AND ultimo_intento IS NOT NULL AND reserva='{"confirmacion":true}')
       OR NOT EXISTS (SELECT FROM convivencia_mensajeria.outbox
                      WHERE id_operacion=second_operation AND accion='Liberar' AND NOT enviado) THEN
        RAISE EXCEPTION 'Estado de entrega o compensación incorrecto';
    END IF;
    UPDATE convivencia_mensajeria.incorporacion SET estado='Terminada',http_status=201,respuesta='{}'
        WHERE id_operacion=operation;
    PERFORM id_operacion FROM convivencia_mensajeria.incorporacion WHERE id_operacion=operation FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'El replay no puede bloquear una operación terminal'; END IF;

    INSERT INTO convivencia_mensajeria.conversacion(id_arriendo)
        VALUES(rental) RETURNING id_conversacion INTO STRICT chat;
    INSERT INTO convivencia_mensajeria.conversacion(id_arriendo)
        VALUES(rental) ON CONFLICT(id_arriendo) DO NOTHING;
    PERFORM creada_en FROM convivencia_mensajeria.pertenencia
        WHERE id_arriendo=rental AND id_usuario=953011 AND estado='Activa' FOR SHARE;
    IF NOT FOUND THEN RAISE EXCEPTION 'FOR SHARE no encontró la pertenencia activa'; END IF;

    INSERT INTO convivencia_mensajeria.mensaje(id_conversacion,id_remitente,nombre_remitente,contenido,id_cliente)
        VALUES(chat,953011,'Actor sintético','original',client_id) RETURNING id_mensaje INTO STRICT message;
    INSERT INTO convivencia_mensajeria.mensaje(id_conversacion,id_remitente,nombre_remitente,contenido,id_cliente)
        VALUES(chat,953011,'Actor sintético','original',client_id)
        ON CONFLICT(id_conversacion,id_remitente,id_cliente) DO NOTHING;
    IF FOUND THEN RAISE EXCEPTION 'Replay insertó un duplicado'; END IF;
    BEGIN
        INSERT INTO convivencia_mensajeria.mensaje(id_conversacion,id_remitente,nombre_remitente,contenido,id_cliente)
            VALUES(chat,953011,'Actor sintético','distinto',client_id);
        RAISE EXCEPTION 'Se admitió un duplicado incompatible';
    EXCEPTION WHEN unique_violation THEN
        GET STACKED DIAGNOSTICS rejected_message = CONSTRAINT_NAME;
        IF rejected_message <> 'mensaje_id_conversacion_id_remitente_id_cliente_key' THEN RAISE; END IF;
    END;
    PERFORM id_mensaje FROM convivencia_mensajeria.mensaje
        WHERE id_conversacion=chat AND id_cliente=client_id AND id_mensaje=message AND contenido='original';
    IF NOT FOUND THEN RAISE EXCEPTION 'Cambió el mensaje original'; END IF;

    FOREACH noop IN ARRAY ARRAY[false,true] LOOP
        SELECT id_pertenencia,estado,terminada_en INTO STRICT membership_id,prior_state,prior_end
        FROM convivencia_mensajeria.pertenencia WHERE id_usuario=953011 AND id_arriendo=rental;
        IF prior_state <> 'Activa' OR prior_end IS NOT NULL
           OR current_user <> 'sql_convivencia_mensajeria'
           OR NOT row_security_active('convivencia_mensajeria.pertenencia')
           OR NOT has_column_privilege(current_user,'convivencia_mensajeria.pertenencia','estado','UPDATE')
        THEN RAISE EXCEPTION 'Precondición incorrecta para probar WITH CHECK'; END IF;
        BEGIN
            IF noop THEN
                UPDATE convivencia_mensajeria.pertenencia SET estado=estado WHERE id_pertenencia=membership_id;
            ELSE
                UPDATE convivencia_mensajeria.pertenencia SET estado='Inactiva' WHERE id_pertenencia=membership_id;
            END IF;
            RAISE EXCEPTION 'UPDATE no rechazado sobre pertenencia activa (sin cambios: %)', noop;
        EXCEPTION WHEN insufficient_privilege THEN
            GET STACKED DIAGNOSTICS rejected_state = RETURNED_SQLSTATE, rejected_message = MESSAGE_TEXT;
            IF rejected_state IS DISTINCT FROM '42501' OR rejected_message IS DISTINCT FROM
                'new row violates row-level security policy for table "pertenencia"' THEN RAISE; END IF;
            RAISE NOTICE 'WITH CHECK rechazó el UPDATE (sin cambios: %, SQLSTATE %)', noop, rejected_state;
        END;
        IF NOT EXISTS (SELECT FROM convivencia_mensajeria.pertenencia
            WHERE id_pertenencia=membership_id AND estado=prior_state
              AND terminada_en IS NOT DISTINCT FROM prior_end)
        THEN RAISE EXCEPTION 'Cambió la pertenencia activa tras el rechazo'; END IF;
    END LOOP;

    BEGIN
        UPDATE convivencia_mensajeria.arriendo SET cupos_totales=2 WHERE id_arriendo=rental;
        RAISE EXCEPTION 'UPDATE de columna protegida inesperado';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
        DELETE FROM convivencia_mensajeria.mensaje WHERE id_mensaje=message;
        RAISE EXCEPTION 'Se permitió DELETE';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
        PERFORM currval('convivencia_mensajeria.mensaje_id_mensaje_seq');
        RAISE EXCEPTION 'Acceso directo a una secuencia inesperado';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
        PERFORM id_usuario FROM auth_users.usuario LIMIT 1;
        RAISE EXCEPTION 'El runtime accedió a Auth';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
END;
$test$;
RESET ROLE;

SET LOCAL ROLE scrum101_owner;
DO $test$
BEGIN
    UPDATE convivencia_mensajeria.pertenencia SET estado='Inactiva'
        WHERE id_usuario=953011 AND estado='Activa';
    IF NOT FOUND OR NOT EXISTS (SELECT FROM convivencia_mensajeria.pertenencia
        WHERE id_usuario=953011 AND terminada_en >= creada_en) THEN
        RAISE EXCEPTION 'El trigger de fin no registró el intervalo';
    END IF;
END;
$test$;
RESET ROLE;

SET LOCAL ROLE sql_convivencia_mensajeria;
DO $test$
DECLARE
    affected bigint;
    membership_id bigint;
    prior_state text;
    prior_end timestamptz;
    noop boolean;
    rejected_state text;
    rejected_message text;
BEGIN
    PERFORM creada_en FROM convivencia_mensajeria.pertenencia WHERE id_usuario=953011 AND estado='Inactiva';
    IF NOT FOUND THEN RAISE EXCEPTION 'La lectura excluyó el historial'; END IF;
    PERFORM creada_en FROM convivencia_mensajeria.pertenencia WHERE id_usuario=953011 FOR SHARE;
    IF FOUND THEN RAISE EXCEPTION 'FOR SHARE permitió bloquear una pertenencia inactiva'; END IF;
    FOREACH noop IN ARRAY ARRAY[false,true] LOOP
        SELECT id_pertenencia,estado,terminada_en INTO STRICT membership_id,prior_state,prior_end
        FROM convivencia_mensajeria.pertenencia WHERE id_usuario=953011;
        IF prior_state <> 'Inactiva' OR prior_end IS NULL
           OR current_user <> 'sql_convivencia_mensajeria'
           OR NOT row_security_active('convivencia_mensajeria.pertenencia')
           OR NOT has_column_privilege(current_user,'convivencia_mensajeria.pertenencia','estado','UPDATE')
        THEN RAISE EXCEPTION 'Precondición incorrecta para probar USING'; END IF;
        IF noop THEN
            UPDATE convivencia_mensajeria.pertenencia SET estado=estado WHERE id_pertenencia=membership_id;
        ELSE
            UPDATE convivencia_mensajeria.pertenencia SET estado='Activa' WHERE id_pertenencia=membership_id;
        END IF;
        GET DIAGNOSTICS affected = ROW_COUNT;
        IF affected <> 0 OR NOT EXISTS (SELECT FROM convivencia_mensajeria.pertenencia
            WHERE id_pertenencia=membership_id AND estado=prior_state
              AND terminada_en IS NOT DISTINCT FROM prior_end)
        THEN RAISE EXCEPTION 'USING no protegió la pertenencia inactiva'; END IF;
    END LOOP;

    BEGIN
        PERFORM set_config('row_security','off',true);
        UPDATE convivencia_mensajeria.pertenencia SET estado='Activa' WHERE id_pertenencia=membership_id;
        RAISE EXCEPTION 'row_security=off eludió RLS';
    EXCEPTION WHEN insufficient_privilege THEN
        GET STACKED DIAGNOSTICS rejected_state = RETURNED_SQLSTATE, rejected_message = MESSAGE_TEXT;
        IF rejected_state IS DISTINCT FROM '42501' OR rejected_message IS DISTINCT FROM
            'query would be affected by row-level security policy for table "pertenencia"' THEN RAISE; END IF;
        RAISE NOTICE 'row_security=off rechazado (SQLSTATE %)', rejected_state;
    END;
    IF current_setting('row_security') <> 'on' OR NOT EXISTS (
        SELECT FROM convivencia_mensajeria.pertenencia WHERE id_pertenencia=membership_id
          AND estado=prior_state AND terminada_en IS NOT DISTINCT FROM prior_end
    ) THEN RAISE EXCEPTION 'row_security=off alteró la configuración o la fila'; END IF;
END;
$test$;
RESET ROLE;

DO $test$
DECLARE
    role_name text;
BEGIN
    FOREACH role_name IN ARRAY ARRAY[
        'sql_auth_users','sql_listado_applications','sql_match_conexion','sql_reportes'
    ] LOOP
        EXECUTE format('SET LOCAL ROLE %I',role_name);
        BEGIN
            PERFORM id_arriendo FROM convivencia_mensajeria.arriendo LIMIT 1;
            RAISE EXCEPTION 'Acceso cruzado por %', role_name;
        EXCEPTION WHEN insufficient_privilege THEN NULL;
        END;
        RESET ROLE;
    END LOOP;
END;
$test$;
ROLLBACK;
