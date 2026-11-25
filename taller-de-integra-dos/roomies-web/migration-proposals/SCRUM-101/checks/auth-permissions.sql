DO $check$
DECLARE
    expected record;
    principal name;
    operation text;
    object_oid oid;
    column_row record;
    allowed boolean;
    runtime_oid oid := 'sql_auth_users'::regrole;
    expected_policies integer := 0;
BEGIN
    FOR expected IN SELECT * FROM (VALUES
            ('usuario', 'SELECT', 'id_usuario,supabase_user_id,nombre,fecha_nacimiento,edad,ocupacion,ciudad,breve_descripcion,sobre_mi,foto_perfil,presupuesto,zona_interes'),
            ('usuario', 'INSERT', 'supabase_user_id,nombre,fecha_nacimiento'),
            ('usuario', 'UPDATE', 'edad,ocupacion,ciudad,breve_descripcion,sobre_mi,foto_perfil,presupuesto,zona_interes'),
            ('notificacion', 'SELECT', 'id,id_usuario,tipo,referencia_id,estado,event_key,creado_en'),
            ('notificacion', 'INSERT', 'id_usuario,tipo,referencia_id,estado,event_key'),
            ('sesion_revocada', 'SELECT', 'session_id'),
            ('sesion_revocada', 'INSERT', 'session_id,subject'),
            ('perfil_comun', 'SELECT', 'supabase_user_id,genero,id_region_interes,id_comuna_interes'),
            ('perfil_comun', 'INSERT', 'supabase_user_id,genero,id_region_interes,id_comuna_interes'),
            ('perfil_comun', 'UPDATE', 'genero,id_region_interes,id_comuna_interes'),
            ('foto_limpieza', 'SELECT', 'reference,subject,creada_en'),
            ('foto_limpieza', 'INSERT', 'reference,subject'),
            ('foto_limpieza', 'DELETE', '')
    ) AS spec(table_name, action, columns)
    LOOP
        expected_policies := expected_policies + 1;
        object_oid := to_regclass('auth_users.' || expected.table_name);
        IF NOT EXISTS (
            SELECT FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
            WHERE c.oid = object_oid AND c.relrowsecurity
              AND p.polname = 'runtime_' || lower(expected.action)
              AND p.polcmd::text = CASE expected.action
                    WHEN 'SELECT' THEN 'r' WHEN 'INSERT' THEN 'a' WHEN 'UPDATE' THEN 'w' ELSE 'd' END
              AND p.polroles = ARRAY[runtime_oid] AND p.polpermissive
              AND pg_get_expr(p.polqual, p.polrelid) IS NOT DISTINCT FROM
                    CASE WHEN expected.action <> 'INSERT' THEN 'true' END
              AND pg_get_expr(p.polwithcheck, p.polrelid) IS NOT DISTINCT FROM
                    CASE WHEN expected.action IN ('INSERT', 'UPDATE') THEN 'true' END
        ) THEN
            RAISE EXCEPTION 'SCRUM-101: política inesperada en % para %', expected.table_name, expected.action;
        END IF;
        FOR column_row IN SELECT attname, attnum FROM pg_attribute
            WHERE attrelid = object_oid AND attnum > 0 AND NOT attisdropped
        LOOP
            IF expected.action <> 'DELETE' AND (
                has_column_privilege(runtime_oid, object_oid, column_row.attnum, expected.action)
                    IS DISTINCT FROM (column_row.attname::text = ANY(string_to_array(expected.columns, ',')))
                OR has_column_privilege(runtime_oid, object_oid, column_row.attnum,
                                        expected.action || ' WITH GRANT OPTION')
            ) THEN
                RAISE EXCEPTION 'SCRUM-101: ACL inesperada en %.% para %',
                    expected.table_name, column_row.attname, expected.action;
            END IF;
        END LOOP;
    END LOOP;

    FOREACH principal IN ARRAY ARRAY[
        'sql_auth_users', 'sql_listado_applications', 'sql_match_conexion',
        'sql_convivencia_mensajeria', 'sql_reportes'
    ]::name[] LOOP
        allowed := principal = 'sql_auth_users';
        IF has_schema_privilege(principal, 'auth_users', 'USAGE') IS DISTINCT FROM allowed
           OR has_schema_privilege(principal, 'auth_users', 'CREATE')
           OR has_schema_privilege(principal, 'auth_users', 'USAGE WITH GRANT OPTION') THEN
            RAISE EXCEPTION 'SCRUM-101: ACL de esquema inesperada para %', principal;
        END IF;
        FOR object_oid IN SELECT oid FROM pg_class
            WHERE relnamespace = 'auth_users'::regnamespace AND relkind = 'r'
        LOOP
            FOREACH operation IN ARRAY ARRAY['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'] LOOP
                IF has_table_privilege(principal, object_oid, operation) IS DISTINCT FROM
                    (allowed AND operation = 'DELETE' AND object_oid = 'auth_users.foto_limpieza'::regclass)
                   OR has_table_privilege(principal, object_oid, operation || ' WITH GRANT OPTION') THEN
                    RAISE EXCEPTION 'SCRUM-101: ACL de tabla inesperada para %, %, %', principal, object_oid::regclass, operation;
                END IF;
            END LOOP;
            IF has_any_column_privilege(principal, object_oid, 'REFERENCES')
               OR (NOT allowed AND has_any_column_privilege(principal, object_oid, 'SELECT, INSERT, UPDATE')) THEN
                RAISE EXCEPTION 'SCRUM-101: ACL de columna inesperada para % en %', principal, object_oid::regclass;
            END IF;
            IF allowed AND (
                (object_oid IN ('auth_users.notificacion'::regclass, 'auth_users.sesion_revocada'::regclass, 'auth_users.foto_limpieza'::regclass)
                 AND has_any_column_privilege(principal, object_oid, 'UPDATE'))
            ) THEN
                RAISE EXCEPTION 'SCRUM-101: UPDATE fuera del contrato en %', object_oid::regclass;
            END IF;
        END LOOP;
        FOR object_oid IN SELECT oid FROM pg_class
            WHERE relnamespace = 'auth_users'::regnamespace AND relkind = 'S'
        LOOP
            IF has_sequence_privilege(principal, object_oid, 'USAGE') IS DISTINCT FROM allowed
               OR has_sequence_privilege(principal, object_oid, 'SELECT, UPDATE, USAGE WITH GRANT OPTION')
               OR NOT EXISTS (SELECT FROM pg_class WHERE oid = object_oid AND relowner = 'scrum101_owner'::regrole) THEN
                RAISE EXCEPTION 'SCRUM-101: ACL o propietario de secuencia inesperado para %', principal;
            END IF;
        END LOOP;
    END LOOP;
    IF (SELECT count(*) FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid
        WHERE c.relnamespace = 'auth_users'::regnamespace) <> expected_policies THEN
        RAISE EXCEPTION 'SCRUM-101: conjunto de políticas Auth inesperado';
    END IF;
END;
$check$;
