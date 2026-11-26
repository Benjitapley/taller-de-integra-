DO $check$
DECLARE
    stage text := current_setting('scrum101.match_stage');
    match_schema oid := to_regnamespace('match_conexion');
    connection_table oid := to_regclass('match_conexion.conexion');
    expected record;
BEGIN
    IF to_regnamespace('haycupo') IS NOT NULL OR EXISTS (SELECT FROM pg_event_trigger) THEN
        RAISE EXCEPTION 'SCRUM-101: esquema legado o event trigger inesperado';
    END IF;
    IF stage = '040' THEN
        IF match_schema IS NOT NULL THEN
            RAISE EXCEPTION 'SCRUM-101: match_conexion ya existe';
        END IF;
        RETURN;
    END IF;
    IF stage NOT IN ('041','verify') OR NOT EXISTS (
        SELECT FROM pg_namespace WHERE oid = match_schema AND nspowner = 'scrum101_owner'::regrole
    ) OR NOT EXISTS (
        SELECT FROM pg_class WHERE oid = connection_table AND relkind = 'r'
          AND relowner = 'scrum101_owner'::regrole AND relrowsecurity AND NOT relforcerowsecurity
    ) OR pg_get_serial_sequence('match_conexion.conexion','id_conexion')
         IS DISTINCT FROM 'match_conexion.conexion_id_conexion_seq'
      OR NOT EXISTS (
        SELECT FROM pg_class WHERE oid = to_regclass('match_conexion.conexion_id_conexion_seq')
          AND relkind = 'S' AND relowner = 'scrum101_owner'::regrole
    ) THEN
        RAISE EXCEPTION 'SCRUM-101: base, identidad, propietario o RLS de Match inesperados';
    END IF;

    IF (SELECT count(*) FROM pg_attribute
        WHERE attrelid = connection_table AND attnum > 0 AND NOT attisdropped) <> 5 THEN
        RAISE EXCEPTION 'SCRUM-101: número inesperado de columnas de conexión';
    END IF;
    FOR expected IN SELECT * FROM (VALUES
        ('id_conexion','bigint','a',NULL),
        ('id_solicitante_FK','bigint','',NULL),
        ('id_receptor_FK','bigint','',NULL),
        ('estado','character varying(20)','','''Pendiente''::character varying'),
        ('fecha_solicitud','timestamp with time zone','','clock_timestamp()')
    ) AS spec(column_name,column_type,identity_kind,default_sql)
    LOOP
        IF NOT EXISTS (
            SELECT FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
            WHERE a.attrelid = connection_table AND a.attnum > 0 AND NOT a.attisdropped
              AND a.attname = expected.column_name AND a.attnotnull
              AND format_type(a.atttypid,a.atttypmod) = expected.column_type
              AND a.attidentity::text = expected.identity_kind
              AND pg_get_expr(d.adbin,d.adrelid) IS NOT DISTINCT FROM expected.default_sql
        ) THEN RAISE EXCEPTION 'SCRUM-101: columna de conexión inesperada: %', expected.column_name; END IF;
    END LOOP;

    IF (SELECT count(*) FROM pg_constraint WHERE conrelid = connection_table AND convalidated) <> 3
       OR NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid = connection_table AND convalidated
                      AND pg_get_constraintdef(oid) = 'PRIMARY KEY (id_conexion)')
       OR NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid = connection_table AND convalidated
                      AND pg_get_constraintdef(oid) = 'CHECK (("id_solicitante_FK" <> "id_receptor_FK"))')
       OR NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid = connection_table AND convalidated
             AND conname = 'conexion_estado_valido'
             AND pg_get_constraintdef(oid) LIKE 'CHECK (%estado%''Pendiente''%''Aceptada''%''Rechazada''%)')
       OR NOT EXISTS (
           SELECT FROM pg_index WHERE indexrelid = to_regclass('match_conexion.conexion_vigente')
             AND indrelid = connection_table AND indisvalid AND indisunique AND indnkeyatts = 2
             AND lower(regexp_replace(pg_get_indexdef(indexrelid,1,false), '[[:space:]]', '', 'g'))
                 = 'least("id_solicitante_fk","id_receptor_fk")'
             AND lower(regexp_replace(pg_get_indexdef(indexrelid,2,false), '[[:space:]]', '', 'g'))
                 = 'greatest("id_solicitante_fk","id_receptor_fk")'
             AND pg_get_expr(indpred,indrelid) LIKE '%estado%''Pendiente''%''Aceptada''%'
             AND pg_get_expr(indpred,indrelid) NOT LIKE '%Rechazada%'
       ) THEN RAISE EXCEPTION 'SCRUM-101: restricciones o índice de conexión inesperados'; END IF;

    IF stage = '041' AND (
        (SELECT count(*) FROM pg_class WHERE relnamespace = match_schema) <> 4
        OR EXISTS (SELECT FROM pg_proc WHERE pronamespace = match_schema)
        OR EXISTS (SELECT FROM pg_trigger WHERE tgrelid = connection_table)
        OR EXISTS (SELECT FROM pg_policy WHERE polrelid = connection_table)
        OR EXISTS (SELECT FROM pg_namespace n CROSS JOIN LATERAL aclexplode(n.nspacl) a
                   WHERE n.oid = match_schema AND a.grantee <> n.nspowner)
        OR EXISTS (SELECT FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a
                   WHERE c.relnamespace = match_schema AND a.grantee <> c.relowner)
        OR EXISTS (SELECT FROM pg_attribute t CROSS JOIN LATERAL aclexplode(t.attacl) a
                   WHERE t.attrelid = connection_table)
    ) THEN RAISE EXCEPTION 'SCRUM-101: objetos o permisos prematuros de Match'; END IF;
END;
$check$;
