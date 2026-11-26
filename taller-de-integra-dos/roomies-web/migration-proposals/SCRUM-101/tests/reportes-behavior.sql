\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '20s';
\ir ../checks/target.sql
\ir ../checks/convivencia-target.sql
SET LOCAL ROLE sql_reportes;

DO $test$
DECLARE
    first_report record;
    later_report record;
    page_id bigint;
    review_id bigint;
    old_state text;
    replay record;
    claimed_event record;
    delivered timestamptz;
    actor_id constant bigint := 962101;
    send_key constant text := 'scrum101:synthetic:962101';
    fingerprint constant text := repeat('a',64);
BEGIN
    IF current_user <> 'sql_reportes' THEN
        RAISE EXCEPTION 'Runtime incorrecto';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtextextended(format('reporte:%s:%s',actor_id,send_key),0));
    INSERT INTO reportes.reporte
        (id_denunciante,id_usuario_reportado,id_publicacion_reportada,categoria,descripcion)
    VALUES (actor_id,962102,NULL,'Sintetica','Caso de persistencia SQL')
    RETURNING id_reporte,tipo,id_usuario_reportado,id_publicacion_reportada,categoria,descripcion,estado,fecha
        INTO STRICT first_report;
    IF first_report.id_reporte IS NULL OR first_report.tipo IS DISTINCT FROM 'Usuario'
        OR first_report.estado IS DISTINCT FROM 'Pendiente' THEN
        RAISE EXCEPTION 'Alta o RETURNING inesperado';
    END IF;
    INSERT INTO reportes.operacion_envio(id_denunciante,clave,huella,respuesta)
    VALUES (actor_id,send_key,fingerprint,to_jsonb(first_report));
    SELECT huella,respuesta INTO STRICT replay
    FROM reportes.operacion_envio WHERE id_denunciante=actor_id AND clave=send_key;
    IF replay.huella::text IS DISTINCT FROM fingerprint
        OR replay.respuesta IS DISTINCT FROM to_jsonb(first_report) THEN
        RAISE EXCEPTION 'Relectura idempotente inesperada';
    END IF;
    RAISE NOTICE 'APROBADO: alta RETURNING, bloqueo asesor e idempotencia';

    INSERT INTO reportes.reporte
        (id_denunciante,id_usuario_reportado,id_publicacion_reportada,categoria,descripcion)
    VALUES (actor_id,NULL,962103,'Sintetica','Segundo elemento de paginacion')
    RETURNING id_reporte,fecha,tipo INTO STRICT later_report;
    IF later_report.tipo IS DISTINCT FROM 'Publicacion' THEN RAISE EXCEPTION 'Tipo generado inesperado'; END IF;
    SELECT id_reporte INTO STRICT page_id FROM reportes.reporte
    WHERE id_denunciante=actor_id ORDER BY fecha DESC,id_reporte DESC LIMIT 1;
    IF page_id IS DISTINCT FROM later_report.id_reporte THEN RAISE EXCEPTION 'Orden de primera pagina incorrecto'; END IF;
    SELECT id_reporte INTO STRICT page_id FROM reportes.reporte
    WHERE id_denunciante=actor_id AND (fecha,id_reporte)<(later_report.fecha,later_report.id_reporte)
    ORDER BY fecha DESC,id_reporte DESC LIMIT 1;
    IF page_id IS DISTINCT FROM first_report.id_reporte THEN RAISE EXCEPTION 'Cursor de reportes propios incorrecto'; END IF;
    SELECT id_reporte INTO STRICT page_id FROM reportes.reporte
    WHERE estado='Pendiente' AND tipo='Usuario' AND (fecha,id_reporte)<(later_report.fecha,later_report.id_reporte)
    ORDER BY fecha DESC,id_reporte DESC LIMIT 1;
    IF page_id IS DISTINCT FROM first_report.id_reporte THEN RAISE EXCEPTION 'Cursor administrativo incorrecto'; END IF;
    RAISE NOTICE 'APROBADO: lecturas y paginacion personal y administrativa';

    SELECT estado INTO STRICT old_state FROM reportes.reporte WHERE id_reporte=first_report.id_reporte FOR UPDATE;
    IF old_state IS DISTINCT FROM 'Pendiente' THEN RAISE EXCEPTION 'Estado inicial incorrecto'; END IF;
    UPDATE reportes.reporte SET estado='En_Revision' WHERE id_reporte=first_report.id_reporte
    RETURNING estado INTO STRICT old_state;
    IF old_state IS DISTINCT FROM 'En_Revision' THEN RAISE EXCEPTION 'Actualizacion de estado incorrecta'; END IF;
    INSERT INTO reportes.reporte_historial(id_reporte,id_administrador,estado_anterior,estado_nuevo,nota_interna)
    VALUES (first_report.id_reporte,962104,'Pendiente','En_Revision','Nota sintetica')
    RETURNING id_actuacion INTO STRICT review_id;
    INSERT INTO reportes.outbox(id_actuacion) VALUES (review_id);
    IF NOT EXISTS (SELECT FROM reportes.reporte_historial h WHERE h.id_actuacion=review_id
                   AND h.id_reporte=first_report.id_reporte AND h.estado_nuevo='En_Revision') THEN
        RAISE EXCEPTION 'Historial no visible';
    END IF;
    RAISE NOTICE 'APROBADO: FOR UPDATE, revision, historial RETURNING y encolado';

    WITH next AS (
        SELECT o.id_actuacion FROM reportes.outbox o
        JOIN reportes.reporte_historial h USING (id_actuacion)
        WHERE o.entregado_en IS NULL AND o.proximo_intento <= clock_timestamp()
          AND NOT EXISTS (
              SELECT FROM reportes.reporte_historial previous
              JOIN reportes.outbox waiting USING (id_actuacion)
              WHERE previous.id_reporte=h.id_reporte
                AND previous.id_actuacion<h.id_actuacion AND waiting.entregado_en IS NULL
          )
        ORDER BY o.proximo_intento,o.id_actuacion
        LIMIT 1 FOR UPDATE OF o SKIP LOCKED
    ), claimed AS (
        UPDATE reportes.outbox o SET proximo_intento=clock_timestamp()+interval '15 seconds'
        FROM next n WHERE o.id_actuacion=n.id_actuacion RETURNING o.id_actuacion
    )
    SELECT c.id_actuacion,r.id_denunciante AS id_usuario,r.id_reporte AS referencia_id,h.estado_nuevo AS estado
    INTO STRICT claimed_event
    FROM claimed c JOIN reportes.reporte_historial h USING (id_actuacion)
    JOIN reportes.reporte r USING (id_reporte);
    IF claimed_event.id_actuacion IS DISTINCT FROM review_id OR claimed_event.id_usuario IS DISTINCT FROM actor_id
        OR claimed_event.referencia_id IS DISTINCT FROM first_report.id_reporte
        OR claimed_event.estado IS DISTINCT FROM 'En_Revision'
        OR NOT EXISTS (SELECT FROM reportes.outbox WHERE id_actuacion=review_id AND proximo_intento>clock_timestamp()) THEN
        RAISE EXCEPTION 'Reserva de aviso incorrecta';
    END IF;
    UPDATE reportes.outbox SET entregado_en=clock_timestamp()
    WHERE id_actuacion=review_id AND entregado_en IS NULL RETURNING entregado_en INTO STRICT delivered;
    IF delivered IS NULL THEN RAISE EXCEPTION 'Entrega no registrada'; END IF;
    RAISE NOTICE 'APROBADO: permisos de SKIP LOCKED y actualizacion de outbox';

    BEGIN
        UPDATE reportes.reporte SET descripcion='No autorizada' WHERE id_reporte=first_report.id_reporte;
        RAISE EXCEPTION 'Se permitio editar la descripcion';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
        DELETE FROM reportes.outbox WHERE id_actuacion=review_id;
        RAISE EXCEPTION 'Se permitio borrar el aviso';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
        PERFORM creada_en FROM reportes.operacion_envio;
        RAISE EXCEPTION 'Se permitio leer creada_en';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    BEGIN
        PERFORM last_value FROM reportes.reporte_id_reporte_seq;
        RAISE EXCEPTION 'Se permitio SELECT directo sobre la secuencia';
    EXCEPTION WHEN insufficient_privilege THEN NULL;
    END;
    RAISE NOTICE 'APROBADO: cuatro denegaciones SQLSTATE 42501 e identidades sin privilegios adicionales';
END;
$test$;
ROLLBACK;
