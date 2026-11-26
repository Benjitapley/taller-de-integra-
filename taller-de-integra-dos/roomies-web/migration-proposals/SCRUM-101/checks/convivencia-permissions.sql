-- Strict post-053 catalog verifier, shared by the migration and the read-only entrypoint.
DO $check$
DECLARE
    ns oid := 'convivencia_mensajeria'::regnamespace;
    owner_oid oid := 'scrum101_owner'::regrole;
    runtime_oid oid := 'sql_convivencia_mensajeria'::regrole;
    item record;
    expected record;
    other_role record;
    tbl oid;
    seq oid;
BEGIN
    IF NOT EXISTS (SELECT FROM pg_namespace WHERE oid = ns AND nspowner = owner_oid)
       OR NOT has_schema_privilege(runtime_oid, ns, 'USAGE')
       OR has_schema_privilege(runtime_oid, ns, 'CREATE,USAGE WITH GRANT OPTION')
       OR (SELECT count(*) FROM pg_namespace n, LATERAL aclexplode(n.nspacl) a
           WHERE n.oid = ns AND a.grantee = runtime_oid
             AND a.grantor = owner_oid AND a.privilege_type = 'USAGE' AND NOT a.is_grantable) <> 1
       OR EXISTS (
           SELECT FROM pg_namespace n, LATERAL aclexplode(COALESCE(n.nspacl, acldefault('n', n.nspowner))) a
           WHERE n.oid = ns AND (a.grantor <> owner_oid OR
             (a.grantee <> owner_oid AND NOT (a.grantee = runtime_oid AND a.privilege_type = 'USAGE' AND NOT a.is_grantable)))
       ) THEN
        RAISE EXCEPTION 'SCRUM-101: propiedad o ACL del esquema inesperada';
    END IF;

    IF (SELECT count(*) FROM pg_class WHERE relnamespace = ns AND relkind = 'r') <> 6
       OR (SELECT count(*) FROM pg_class WHERE relnamespace = ns AND relkind = 'S') <> 5
       OR (SELECT count(*) FROM pg_class WHERE relnamespace = ns AND relkind = 'i') <> 18
       OR (SELECT count(*) FROM pg_constraint WHERE connamespace = ns) <> 34
       OR EXISTS (SELECT FROM pg_class WHERE relnamespace = ns AND (
           relowner <> owner_oid OR relkind NOT IN ('r','S','i')
           OR (relkind = 'r' AND (NOT relrowsecurity OR relforcerowsecurity))))
       OR EXISTS (
           SELECT FROM pg_class c, LATERAL aclexplode(COALESCE(c.relacl, acldefault(
               CASE WHEN c.relkind = 'S' THEN 's'::"char" ELSE 'r'::"char" END, c.relowner))) a
           WHERE c.relnamespace = ns AND c.relkind IN ('r','S')
             AND (a.grantee <> owner_oid OR a.grantor <> owner_oid)
       ) THEN
        RAISE EXCEPTION 'SCRUM-101: inventario, propiedad, RLS o ACL de relación inesperados';
    END IF;

    IF (SELECT count(*) FROM pg_proc WHERE pronamespace = ns) <> 2
       OR EXISTS (
           SELECT FROM pg_proc p WHERE p.pronamespace = ns
             AND (p.proowner <> owner_oid OR p.prosecdef OR has_function_privilege(runtime_oid,p.oid,'EXECUTE')
               OR EXISTS (SELECT FROM aclexplode(COALESCE(p.proacl,acldefault('f',p.proowner))) a
                          WHERE a.grantee <> owner_oid OR a.grantor <> owner_oid))
       ) OR (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
             WHERE c.relnamespace = ns AND NOT t.tgisinternal) <> 2
       OR NOT EXISTS (
           SELECT FROM pg_trigger WHERE tgrelid = 'convivencia_mensajeria.pertenencia'::regclass
             AND tgname = 'pertenencia_capacidad' AND tgenabled = 'O' AND NOT tgisinternal
             AND tgfoid = 'convivencia_mensajeria.validar_cupo()'::regprocedure AND tgtype = 23
       ) OR NOT EXISTS (
           SELECT FROM pg_trigger WHERE tgrelid = 'convivencia_mensajeria.pertenencia'::regclass
             AND tgname = 'registrar_fin_pertenencia' AND tgenabled = 'O' AND NOT tgisinternal
             AND tgfoid = 'convivencia_mensajeria.registrar_fin_pertenencia()'::regprocedure AND tgtype = 19
       ) THEN
        RAISE EXCEPTION 'SCRUM-101: funciones invocadoras, triggers o acceso directo inesperados';
    END IF;

    FOR item IN SELECT * FROM (VALUES
        ('incorporacion', ARRAY['id_operacion','payload','etapa','estado','http_status','respuesta','creada_en','ultimo_intento'],
         ARRAY['id_operacion','payload'], ARRAY['etapa','estado','http_status','respuesta','ultimo_intento']),
        ('arriendo', ARRAY['id_arriendo','id_publicacion','cupos_totales','version_capacidad','creado_en','version_ocupacion'],
         ARRAY['id_publicacion','cupos_totales','version_capacidad'], ARRAY['version_ocupacion']),
        ('pertenencia', ARRAY['id_pertenencia','id_arriendo','id_usuario','id_postulacion','id_operacion','estado','creada_en','terminada_en'],
         ARRAY['id_arriendo','id_usuario','id_postulacion','id_operacion'], ARRAY['estado']),
        ('outbox', ARRAY['id_outbox','id_operacion','accion','reserva','enviado','ultimo_intento'],
         ARRAY['id_operacion','accion','reserva'], ARRAY['ultimo_intento','reserva','enviado']),
        ('conversacion', ARRAY['id_conversacion','id_arriendo','creada_en'],
         ARRAY['id_arriendo'], ARRAY[]::text[]),
        ('mensaje', ARRAY['id_mensaje','id_conversacion','id_remitente','nombre_remitente','contenido','id_cliente','fecha_envio'],
         ARRAY['id_conversacion','id_remitente','nombre_remitente','contenido','id_cliente'], ARRAY[]::text[])
    ) v(table_name, read_cols, insert_cols, update_cols) LOOP
        tbl := to_regclass('convivencia_mensajeria.' || item.table_name);
        IF NOT EXISTS (SELECT FROM pg_class WHERE oid = tbl AND relkind = 'r')
           OR has_table_privilege(runtime_oid, tbl, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
           OR (SELECT count(*) FROM pg_attribute WHERE attrelid = tbl AND attnum > 0 AND NOT attisdropped)
                <> cardinality(item.read_cols)
           OR EXISTS (
               SELECT FROM pg_attribute a WHERE a.attrelid = tbl AND a.attnum > 0 AND NOT a.attisdropped
                 AND (NOT (a.attname::text = ANY(item.read_cols))
                   OR NOT has_column_privilege(runtime_oid,tbl,a.attnum,'SELECT')
                   OR has_column_privilege(runtime_oid,tbl,a.attnum,'INSERT')
                        IS DISTINCT FROM (a.attname::text = ANY(item.insert_cols))
                   OR has_column_privilege(runtime_oid,tbl,a.attnum,'UPDATE')
                        IS DISTINCT FROM (a.attname::text = ANY(item.update_cols))
                   OR has_column_privilege(runtime_oid,tbl,a.attnum,'REFERENCES'))
           ) OR EXISTS (
               SELECT FROM pg_attribute a, LATERAL aclexplode(a.attacl) acl
               WHERE a.attrelid = tbl AND (acl.grantor <> owner_oid
                 OR (acl.grantee <> owner_oid AND NOT (acl.grantee = runtime_oid
                   AND a.attnum > 0 AND NOT a.attisdropped AND NOT acl.is_grantable AND (
                     (acl.privilege_type = 'SELECT' AND a.attname::text = ANY(item.read_cols))
                     OR (acl.privilege_type = 'INSERT' AND a.attname::text = ANY(item.insert_cols))
                     OR (acl.privilege_type = 'UPDATE' AND a.attname::text = ANY(item.update_cols))
                   ))))
           ) THEN
            RAISE EXCEPTION 'SCRUM-101: ACL de tabla o columna inesperada para %', item.table_name;
        END IF;

        IF item.table_name <> 'incorporacion' THEN
            seq := to_regclass('convivencia_mensajeria.' || item.table_name || '_' || item.read_cols[1] || '_seq');
            IF seq IS NULL OR seq IS DISTINCT FROM to_regclass(pg_get_serial_sequence(
                'convivencia_mensajeria.' || item.table_name, item.read_cols[1]))
               OR NOT EXISTS (SELECT FROM pg_attribute WHERE attrelid = tbl
                              AND attname = item.read_cols[1] AND attidentity = 'a')
               OR has_sequence_privilege(runtime_oid,seq,'USAGE,SELECT,UPDATE') THEN
                RAISE EXCEPTION 'SCRUM-101: identidad o ACL de secuencia inesperada para %', item.table_name;
            END IF;
        END IF;

        -- Exact policy set. An additional permissive UPDATE or ALL could bypass WITH CHECK false.
        IF (SELECT count(*) FROM pg_policy WHERE polrelid = tbl)
             <> (CASE WHEN cardinality(item.update_cols) = 0 THEN 2 ELSE 3 END) THEN
            RAISE EXCEPTION 'SCRUM-101: inventario de políticas inesperado para %', item.table_name;
        END IF;
        FOR expected IN SELECT * FROM (VALUES
            ('runtime_select','r','true',NULL),
            ('runtime_insert','a',NULL,CASE WHEN item.table_name = 'pertenencia'
                 THEN 'estado = ''Activa''::text AND terminada_en IS NULL' ELSE 'true' END),
            ('runtime_update','w',CASE WHEN item.table_name = 'pertenencia'
                 THEN 'estado = ''Activa''::text' ELSE 'true' END,
                 CASE WHEN item.table_name = 'pertenencia' THEN 'false' ELSE 'true' END)
        ) v(policy_name, action, row_filter, write_check)
        WHERE action <> 'w' OR cardinality(item.update_cols) > 0 LOOP
            IF NOT EXISTS (
                SELECT FROM pg_policy p WHERE p.polrelid = tbl AND p.polname = expected.policy_name
                  AND p.polcmd::text = expected.action AND p.polpermissive AND p.polroles = ARRAY[runtime_oid]
                  AND pg_get_expr(p.polqual,tbl,true) IS NOT DISTINCT FROM expected.row_filter
                  AND pg_get_expr(p.polwithcheck,tbl,true) IS NOT DISTINCT FROM expected.write_check
            ) THEN
                RAISE EXCEPTION 'SCRUM-101: política inesperada: %.%', item.table_name, expected.policy_name;
            END IF;
        END LOOP;
    END LOOP;

    FOR other_role IN SELECT oid, rolname FROM pg_roles WHERE rolname IN (
        'sql_auth_users', 'sql_listado_applications', 'sql_match_conexion', 'sql_reportes'
    ) LOOP
        IF has_schema_privilege(other_role.oid,ns,'USAGE,CREATE') OR EXISTS (
            SELECT FROM pg_class c WHERE c.relnamespace = ns AND (CASE c.relkind
                WHEN 'r' THEN has_table_privilege(other_role.oid,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
                    OR has_any_column_privilege(other_role.oid,c.oid,'SELECT,INSERT,UPDATE,REFERENCES')
                WHEN 'S' THEN has_sequence_privilege(other_role.oid,c.oid,'USAGE,SELECT,UPDATE')
                ELSE false END)
        ) OR EXISTS (SELECT FROM pg_proc p WHERE p.pronamespace = ns
                     AND has_function_privilege(other_role.oid,p.oid,'EXECUTE')) THEN
            RAISE EXCEPTION 'SCRUM-101: acceso inesperado para %', other_role.rolname;
        END IF;
    END LOOP;
END;
$check$;
