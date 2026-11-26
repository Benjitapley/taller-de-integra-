DO $check$
DECLARE
    principal record;
    spec record;
    attribute record;
    operation text;
    runtime_oid oid := 'sql_match_conexion'::regrole;
    seq oid := 'match_conexion.conexion_id_conexion_seq'::regclass;
    fn oid := 'match_conexion.registrar_relacion_aceptada()'::regprocedure;
    listed boolean;
    permitted boolean;
BEGIN
    FOR principal IN SELECT oid, rolname FROM pg_roles WHERE rolname IN (
        'sql_auth_users','sql_listado_applications','sql_match_conexion','sql_convivencia_mensajeria','sql_reportes'
    ) LOOP
        listed := principal.oid = runtime_oid;
        IF has_schema_privilege(principal.oid, 'match_conexion', 'USAGE') IS DISTINCT FROM listed
           OR has_schema_privilege(principal.oid, 'match_conexion', 'CREATE, USAGE WITH GRANT OPTION')
           OR has_sequence_privilege(principal.oid, seq, 'USAGE') IS DISTINCT FROM listed
           OR has_sequence_privilege(principal.oid, seq, 'SELECT, UPDATE, USAGE WITH GRANT OPTION')
           OR has_function_privilege(principal.oid, fn, 'EXECUTE')
        THEN RAISE EXCEPTION 'SCRUM-101: ACL de esquema, secuencia o función inesperada para %', principal.rolname; END IF;

        FOR spec IN SELECT oid,relname FROM pg_class WHERE relnamespace = 'match_conexion'::regnamespace AND relkind = 'r'
        LOOP
            FOREACH operation IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] LOOP
                permitted := listed AND spec.relname = 'conexion' AND operation = 'DELETE';
                IF has_table_privilege(principal.oid,spec.oid,operation) IS DISTINCT FROM permitted
                   OR has_table_privilege(principal.oid,spec.oid,operation || ' WITH GRANT OPTION')
                THEN RAISE EXCEPTION 'SCRUM-101: ACL de tabla inesperada para %, %, %', principal.rolname, spec.relname, operation; END IF;
            END LOOP;
            FOR attribute IN SELECT attname,attnum FROM pg_attribute
                WHERE attrelid = spec.oid AND attnum > 0 AND NOT attisdropped
            LOOP
                FOREACH operation IN ARRAY ARRAY['SELECT','INSERT','UPDATE','REFERENCES'] LOOP
                    permitted := listed AND (
                        operation = 'SELECT' OR (spec.relname = 'conexion' AND (
                            (operation = 'INSERT' AND attribute.attname IN ('id_solicitante_FK','id_receptor_FK'))
                            OR (operation = 'UPDATE' AND attribute.attname = 'estado')
                        ))
                    );
                    IF has_column_privilege(principal.oid,spec.oid,attribute.attnum,operation) IS DISTINCT FROM permitted
                       OR has_column_privilege(principal.oid,spec.oid,attribute.attnum,operation || ' WITH GRANT OPTION')
                    THEN RAISE EXCEPTION 'SCRUM-101: ACL de columna inesperada para %, %.%, %',
                        principal.rolname, spec.relname, attribute.attname, operation; END IF;
                END LOOP;
            END LOOP;
        END LOOP;
    END LOOP;

    IF EXISTS (SELECT FROM pg_proc p CROSS JOIN LATERAL aclexplode(coalesce(p.proacl,acldefault('f',p.proowner))) a
               WHERE p.oid = fn AND a.grantee <> p.proowner)
       OR EXISTS (SELECT FROM pg_namespace n CROSS JOIN LATERAL aclexplode(n.nspacl) a
                  WHERE n.nspname = 'match_conexion' AND a.grantee NOT IN (n.nspowner,runtime_oid))
       OR EXISTS (SELECT FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a
                  WHERE c.relnamespace = 'match_conexion'::regnamespace AND a.grantee NOT IN (c.relowner,runtime_oid))
       OR EXISTS (SELECT FROM pg_attribute t JOIN pg_class c ON c.oid = t.attrelid CROSS JOIN LATERAL aclexplode(t.attacl) a
                  WHERE c.relnamespace = 'match_conexion'::regnamespace AND a.grantee NOT IN (c.relowner,runtime_oid))
    THEN RAISE EXCEPTION 'SCRUM-101: grants imprevistos en Match'; END IF;

    FOR spec IN SELECT * FROM (VALUES
        ('conexion','runtime_select','r','true',NULL),
        ('conexion','runtime_insert','a',NULL,'true'),
        ('conexion','runtime_update','w','true','true'),
        ('conexion','runtime_delete','d','true',NULL),
        ('relacion_aceptada','lectura_match','r','true',NULL)
    ) AS expected(table_name,policy_name,command,qual,with_check)
    LOOP
        IF NOT EXISTS (
            SELECT FROM pg_policy p WHERE p.polrelid = to_regclass('match_conexion.' || spec.table_name)
              AND p.polname = spec.policy_name AND p.polcmd::text = spec.command
              AND p.polroles = ARRAY[runtime_oid] AND p.polpermissive
              AND pg_get_expr(p.polqual,p.polrelid) IS NOT DISTINCT FROM spec.qual
              AND pg_get_expr(p.polwithcheck,p.polrelid) IS NOT DISTINCT FROM spec.with_check
        ) THEN RAISE EXCEPTION 'SCRUM-101: política inesperada: %', spec.policy_name; END IF;
    END LOOP;
    IF (SELECT count(*) FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
        WHERE c.relnamespace = 'match_conexion'::regnamespace) <> 5
    THEN RAISE EXCEPTION 'SCRUM-101: políticas adicionales en Match'; END IF;
END;
$check$;
