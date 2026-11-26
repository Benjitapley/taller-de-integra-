DO $check$
DECLARE
    stage text := current_setting('scrum101.listado_stage');
    expected text[];
    actual text[];
    relation record;
    populated boolean;
    namespace_oid oid;
BEGIN
    IF to_regnamespace('haycupo') IS NOT NULL OR EXISTS (SELECT FROM pg_event_trigger) THEN
        RAISE EXCEPTION 'SCRUM-101: haycupo presente en el ensayo private-v1';
    END IF;
    IF stage = '030' THEN
        IF to_regnamespace('listado_applications') IS NOT NULL THEN
            RAISE EXCEPTION 'SCRUM-101: listado_applications ya existe';
        END IF;
        RETURN;
    END IF;

    expected := CASE stage
        WHEN '031' THEN ARRAY['imagen_publicacion', 'outbox', 'postulacion', 'publicacion']
        WHEN '032' THEN ARRAY['comuna', 'imagen_publicacion', 'outbox', 'postulacion', 'publicacion', 'region']
        WHEN '033' THEN ARRAY['comuna', 'imagen_publicacion', 'outbox', 'postulacion', 'publicacion', 'publication_image_cleanup', 'publication_image_operation', 'region']
        WHEN '034' THEN ARRAY['comuna', 'imagen_publicacion', 'outbox', 'postulacion', 'publicacion', 'publication_image_cleanup', 'publication_image_operation', 'region']
    END;
    namespace_oid := to_regnamespace('listado_applications');
    SELECT array_agg(relname::text ORDER BY relname::text COLLATE "C") INTO actual
    FROM pg_class WHERE relnamespace = namespace_oid AND relkind = 'r';
    IF expected IS NULL OR actual IS DISTINCT FROM expected
       OR NOT EXISTS (SELECT FROM pg_namespace WHERE nspname = 'listado_applications'
                      AND nspowner = 'scrum101_owner'::regrole)
       OR EXISTS (SELECT FROM pg_class WHERE relnamespace = 'listado_applications'::regnamespace
                  AND (relowner <> 'scrum101_owner'::regrole OR relrowsecurity))
       OR EXISTS (
           SELECT FROM pg_namespace n CROSS JOIN LATERAL aclexplode(n.nspacl) a
           WHERE n.oid = namespace_oid AND a.grantee <> n.nspowner
       )
       OR EXISTS (
           SELECT FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a
           WHERE c.relnamespace = namespace_oid AND a.grantee <> c.relowner
       )
       OR EXISTS (
           SELECT FROM pg_attribute c JOIN pg_class t ON t.oid = c.attrelid
           CROSS JOIN LATERAL aclexplode(c.attacl) a
           WHERE t.relnamespace = namespace_oid AND a.grantee <> t.relowner
       )
       OR EXISTS (SELECT FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
                  WHERE c.relnamespace = 'listado_applications'::regnamespace AND NOT t.tgisinternal)
    THEN
        RAISE EXCEPTION 'SCRUM-101: estado previo de Listado inesperado en %', stage;
    END IF;

    FOR relation IN SELECT c.relname FROM pg_class c
        WHERE c.relnamespace = 'listado_applications'::regnamespace AND c.relkind = 'r'
          AND (stage <> '034' OR c.relname NOT IN ('region','comuna'))
    LOOP
        EXECUTE format('SELECT EXISTS (SELECT FROM listado_applications.%I)', relation.relname) INTO STRICT populated;
        IF populated THEN
            RAISE EXCEPTION 'SCRUM-101: filas inesperadas en %', relation.relname;
        END IF;
    END LOOP;
END;
$check$;
