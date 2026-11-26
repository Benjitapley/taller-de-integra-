\set ON_ERROR_STOP on
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '15s';
SET LOCAL TimeZone = 'UTC';
\ir ../checks/target.sql
\ir ../checks/convivencia-target.sql
\ir ../checks/provisioned.sql
\ir ../checks/convivencia-permissions.sql
SELECT set_config('scrum101.cleanup_sha256', :'approved_fixture_sha256', true) AS approved \gset

LOCK TABLE convivencia_mensajeria.incorporacion, convivencia_mensajeria.arriendo,
    convivencia_mensajeria.pertenencia, convivencia_mensajeria.outbox,
    convivencia_mensajeria.conversacion, convivencia_mensajeria.mensaje
    IN SHARE ROW EXCLUSIVE MODE;
\ir convivencia-concurrency-inventory.sql
SELECT set_config('scrum101.observed_cleanup_sha256',
    encode(sha256(convert_to(:'fixture_rows','UTF8')),'hex'), true) AS observed \gset
DO $check$
BEGIN
    IF current_setting('scrum101.cleanup_sha256') !~ '^[a-f0-9]{64}$'
       OR current_setting('scrum101.cleanup_sha256') <> current_setting('scrum101.observed_cleanup_sha256')
       OR EXISTS (SELECT FROM pg_stat_activity WHERE pid <> pg_backend_pid()
                  AND backend_type IN ('client backend','autovacuum worker','logical replication worker','parallel worker'))
       OR EXISTS (SELECT FROM pg_prepared_xacts)
       OR EXISTS (
           SELECT FROM pg_constraint k JOIN pg_class ref ON ref.oid=k.confrelid
           JOIN pg_class src ON src.oid=k.conrelid
           WHERE k.contype='f' AND ref.relnamespace='convivencia_mensajeria'::regnamespace
             AND (src.relnamespace <> ref.relnamespace OR k.confdeltype <> 'a')
       )
       OR EXISTS (
           SELECT FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid
           WHERE c.relnamespace='convivencia_mensajeria'::regnamespace
             AND NOT t.tgisinternal AND (t.tgtype & 8) <> 0
       )
       OR EXISTS (
           SELECT FROM pg_rewrite r JOIN pg_class c ON c.oid=r.ev_class
           WHERE c.relnamespace='convivencia_mensajeria'::regnamespace
       )
    THEN RAISE EXCEPTION 'SCRUM-101: limpieza rechazada por huella o destino inseguro'; END IF;
END;
$check$;

SET LOCAL ROLE scrum101_owner;
DO $cleanup$
DECLARE
    affected bigint;
BEGIN
    DELETE FROM convivencia_mensajeria.mensaje m
    USING convivencia_mensajeria.conversacion c, convivencia_mensajeria.arriendo a
    WHERE m.id_conversacion=c.id_conversacion AND c.id_arriendo=a.id_arriendo
      AND a.id_publicacion=953201 AND m.id_remitente=953301
      AND m.id_cliente='00000000-0000-4000-8000-000000953601'
      AND m.nombre_remitente='Actor sintético' AND m.contenido='Envío previo';
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 1 THEN RAISE EXCEPTION 'Inventario de mensajes inesperado'; END IF;

    DELETE FROM convivencia_mensajeria.outbox o USING convivencia_mensajeria.incorporacion i
    WHERE o.id_operacion=i.id_operacion AND i.payload='{"scrum101":"053-concurrency"}'::jsonb
      AND (o.id_operacion,o.accion) IN (
          ('00000000-0000-4000-8000-000000953105'::uuid,'Confirmar'),
          ('00000000-0000-4000-8000-000000953106'::uuid,'Liberar'))
      AND NOT o.enviado AND o.ultimo_intento IS NULL AND o.reserva='{}'::jsonb;
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 2 THEN RAISE EXCEPTION 'Inventario de outbox inesperado'; END IF;

    DELETE FROM convivencia_mensajeria.pertenencia p
    USING convivencia_mensajeria.arriendo a, convivencia_mensajeria.incorporacion i
    WHERE p.id_arriendo=a.id_arriendo AND p.id_operacion=i.id_operacion
      AND i.payload='{"scrum101":"053-concurrency"}'::jsonb
      AND (a.id_publicacion,p.id_usuario,p.id_postulacion,p.id_operacion,p.estado) IN (
          (953201,953301,953401,'00000000-0000-4000-8000-000000953101'::uuid,'Activa'),
          (953202,953302,953402,'00000000-0000-4000-8000-000000953102'::uuid,'Inactiva'),
          (953203,953303,953403,'00000000-0000-4000-8000-000000953103'::uuid,'Activa'));
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 3 THEN RAISE EXCEPTION 'Inventario de pertenencias inesperado'; END IF;

    DELETE FROM convivencia_mensajeria.conversacion c USING convivencia_mensajeria.arriendo a
    WHERE c.id_arriendo=a.id_arriendo AND a.id_publicacion IN (953201,953202);
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 2 THEN RAISE EXCEPTION 'Inventario de conversaciones inesperado'; END IF;

    DELETE FROM convivencia_mensajeria.arriendo
    WHERE id_publicacion IN (953201,953202,953203) AND cupos_totales=1 AND version_capacidad=1 AND version_ocupacion=0;
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 3 THEN RAISE EXCEPTION 'Inventario de arriendos inesperado'; END IF;

    DELETE FROM convivencia_mensajeria.incorporacion
    WHERE id_operacion IN (
        SELECT ('00000000-0000-4000-8000-' || lpad(g::text,12,'0'))::uuid
        FROM generate_series(953101,953106) g
    ) AND payload='{"scrum101":"053-concurrency"}'::jsonb AND estado='Pendiente';
    GET DIAGNOSTICS affected = ROW_COUNT;
    IF affected <> 6 THEN RAISE EXCEPTION 'Inventario de incorporaciones inesperado'; END IF;

    IF EXISTS (SELECT FROM convivencia_mensajeria.incorporacion)
       OR EXISTS (SELECT FROM convivencia_mensajeria.arriendo)
       OR EXISTS (SELECT FROM convivencia_mensajeria.pertenencia)
       OR EXISTS (SELECT FROM convivencia_mensajeria.outbox)
       OR EXISTS (SELECT FROM convivencia_mensajeria.conversacion)
       OR EXISTS (SELECT FROM convivencia_mensajeria.mensaje)
    THEN RAISE EXCEPTION 'La limpieza no dejó el inventario sintético vacío'; END IF;
END;
$cleanup$;
RESET ROLE;
COMMIT;
