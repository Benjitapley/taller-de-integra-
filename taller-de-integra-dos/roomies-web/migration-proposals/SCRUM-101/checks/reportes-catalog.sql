DO $verify$
DECLARE
    stage int := current_setting('scrum101.reportes_stage')::int;
    ns oid := to_regnamespace('reportes');
    owner_oid oid := 'scrum101_owner'::regrole;
    runtime oid := 'sql_reportes'::regrole;
    entity record;
    col record;
    role_row record;
    privilege text;
    expected boolean;
    active boolean := stage = 62;
BEGIN
    IF stage = 59 THEN
        IF ns IS NOT NULL THEN RAISE EXCEPTION 'Reportes ya existe'; END IF;
        RETURN;
    END IF;
    IF stage NOT IN (60,61,62) OR ns IS NULL OR
       NOT EXISTS (SELECT FROM pg_namespace WHERE oid=ns AND nspowner=owner_oid) THEN
        RAISE EXCEPTION 'Esquema o etapa de Reportes inesperados';
    END IF;

    IF (SELECT array_agg(relname::text ORDER BY relname::text COLLATE "C") FROM pg_class WHERE relnamespace=ns)
       IS DISTINCT FROM (CASE WHEN stage=60 THEN ARRAY[
           'reporte','reporte_denunciante_fecha','reporte_fecha','reporte_id_reporte_seq','reporte_pkey']
       ELSE ARRAY['operacion_envio','operacion_envio_pkey','outbox','outbox_pkey','reporte',
           'reporte_denunciante_fecha','reporte_fecha','reporte_historial','reporte_historial_id_actuacion_seq',
           'reporte_historial_orden','reporte_historial_pkey','reporte_id_reporte_seq',
           'reporte_outbox_pendiente','reporte_pkey'] END)
       OR EXISTS (SELECT FROM pg_class WHERE relnamespace=ns AND relowner<>owner_oid)
       OR EXISTS (SELECT FROM pg_proc WHERE pronamespace=ns)
       OR EXISTS (SELECT FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid WHERE c.relnamespace=ns AND NOT t.tgisinternal)
    THEN RAISE EXCEPTION 'Inventario o propietarios de Reportes inesperados'; END IF;

    IF EXISTS (
        WITH expected AS (
            SELECT * FROM (VALUES
                ('reporte',1,'id_reporte','bigint','a'),
                ('reporte',2,'id_denunciante','bigint','n'),
                ('reporte',3,'id_usuario_reportado','bigint','o'),
                ('reporte',4,'id_publicacion_reportada','bigint','o'),
                ('reporte',5,'tipo','text','g'),
                ('reporte',6,'categoria','text','n'),
                ('reporte',7,'descripcion','text','n'),
                ('reporte',8,'estado','text','d'),
                ('reporte',9,'fecha','timestamp with time zone','t'),
                ('reporte_historial',1,'id_actuacion','bigint','a'),
                ('reporte_historial',2,'id_reporte','bigint','n'),
                ('reporte_historial',3,'id_administrador','bigint','n'),
                ('reporte_historial',4,'estado_anterior','text','n'),
                ('reporte_historial',5,'estado_nuevo','text','n'),
                ('reporte_historial',6,'nota_interna','text','o'),
                ('reporte_historial',7,'fecha','timestamp with time zone','t'),
                ('outbox',1,'id_actuacion','bigint','n'),
                ('outbox',2,'proximo_intento','timestamp with time zone','t'),
                ('outbox',3,'entregado_en','timestamp with time zone','o'),
                ('operacion_envio',1,'id_denunciante','bigint','n'),
                ('operacion_envio',2,'clave','character varying(80)','n'),
                ('operacion_envio',3,'huella','character(64)','n'),
                ('operacion_envio',4,'respuesta','jsonb','n'),
                ('operacion_envio',5,'creada_en','timestamp with time zone','t')
            ) v(tab,pos,col,typ,flag) WHERE stage<>60 OR tab='reporte'
        ), actual AS (
            SELECT c.relname::text AS tab,a.attnum AS pos,a.attname::text AS col,
                format_type(a.atttypid,a.atttypmod) AS typ, CASE
                WHEN a.attidentity='a' AND a.attnotnull THEN 'a'
                -- PostgreSQL 17 indents CASE with a leading newline. Collapse whitespace before trimming.
                WHEN a.attgenerated='s' AND NOT a.attnotnull AND btrim(regexp_replace(pg_get_expr(d.adbin,d.adrelid,true), '[[:space:]]+', ' ', 'g')) =
                    'CASE WHEN id_usuario_reportado IS NULL THEN ''Publicacion''::text ELSE ''Usuario''::text END' THEN 'g'
                WHEN a.attnotnull AND pg_get_expr(d.adbin,d.adrelid)='''Pendiente''::text' THEN 'd'
                WHEN a.attnotnull AND pg_get_expr(d.adbin,d.adrelid)='clock_timestamp()' THEN 't'
                WHEN d.oid IS NULL AND a.attidentity='' AND a.attgenerated='' THEN CASE WHEN a.attnotnull THEN 'n' ELSE 'o' END
                ELSE '?' END AS flag
            FROM pg_class c JOIN pg_attribute a ON a.attrelid=c.oid
            LEFT JOIN pg_attrdef d ON d.adrelid=c.oid AND d.adnum=a.attnum
            WHERE c.relnamespace=ns AND c.relkind='r' AND a.attnum>0 AND NOT a.attisdropped
        )
        (SELECT * FROM expected EXCEPT SELECT * FROM actual)
        UNION ALL (SELECT * FROM actual EXCEPT SELECT * FROM expected)
    ) THEN RAISE EXCEPTION 'Columnas, identidades o defaults de Reportes inesperados'; END IF;

    FOR entity IN SELECT * FROM (VALUES
        ('reporte_id_reporte_seq','reporte','id_reporte'),
        ('reporte_historial_id_actuacion_seq','reporte_historial','id_actuacion')
    ) v(seq,tab,col) WHERE stage<>60 OR tab='reporte' LOOP
        IF pg_get_serial_sequence('reportes.'||entity.tab,entity.col)::regclass IS DISTINCT FROM
           to_regclass('reportes.'||entity.seq)
           OR NOT EXISTS (SELECT FROM pg_sequence WHERE seqrelid=to_regclass('reportes.'||entity.seq)
               AND seqtypid='bigint'::regtype AND seqstart=1 AND seqincrement=1 AND seqmin=1
               AND seqmax=9223372036854775807 AND seqcache=1 AND NOT seqcycle)
        THEN RAISE EXCEPTION 'Secuencia inesperada: %', entity.seq; END IF;
    END LOOP;

    FOR entity IN SELECT * FROM (VALUES
        ('reporte','reporte_pkey','PRIMARY KEY (id_reporte)'),
        ('reporte_historial','reporte_historial_pkey','PRIMARY KEY (id_actuacion)'),
        ('reporte_historial','reporte_historial_id_reporte_fkey','FOREIGN KEY (id_reporte) REFERENCES reportes.reporte(id_reporte)'),
        ('outbox','outbox_pkey','PRIMARY KEY (id_actuacion)'),
        ('outbox','outbox_id_actuacion_fkey','FOREIGN KEY (id_actuacion) REFERENCES reportes.reporte_historial(id_actuacion)'),
        ('operacion_envio','operacion_envio_pkey','PRIMARY KEY (id_denunciante, clave)')
    ) v(tab,con,definition) WHERE stage<>60 OR tab='reporte' LOOP
        IF NOT EXISTS (SELECT FROM pg_constraint WHERE conrelid=to_regclass('reportes.'||entity.tab)
            AND conname=entity.con AND convalidated AND NOT condeferrable AND pg_get_constraintdef(oid)=entity.definition)
        THEN RAISE EXCEPTION 'Clave inesperada: %',entity.con; END IF;
    END LOOP;

    FOR entity IN SELECT * FROM (VALUES
        ('reporte',7),('reporte_historial',3),('outbox',0),('operacion_envio',2)
    ) v(tab,total) WHERE stage<>60 OR tab='reporte' LOOP
        IF (SELECT count(*) FROM pg_constraint WHERE conrelid=to_regclass('reportes.'||entity.tab)
            AND contype='c' AND convalidated AND NOT connoinherit) <> entity.total
        THEN RAISE EXCEPTION 'CHECK faltante o inválido en %',entity.tab; END IF;
    END LOOP;

    FOR entity IN SELECT * FROM (VALUES
        ('reporte',$expr$id_denunciante > 0$expr$),
        ('reporte',$expr$id_usuario_reportado > 0 AND id_usuario_reportado <> id_denunciante$expr$),
        ('reporte',$expr$id_publicacion_reportada > 0$expr$),
        ('reporte',$expr$char_length(btrim(categoria)) >= 1 AND char_length(btrim(categoria)) <= 80$expr$),
        ('reporte',$expr$char_length(btrim(descripcion)) >= 1 AND char_length(btrim(descripcion)) <= 1000$expr$),
        ('reporte',$expr$estado = ANY (ARRAY['Pendiente'::text, 'En_Revision'::text, 'Resuelto'::text, 'Descartado'::text])$expr$),
        ('reporte',$expr$num_nonnulls(id_usuario_reportado, id_publicacion_reportada) = 1$expr$),
        ('reporte_historial',$expr$id_administrador > 0$expr$),
        ('reporte_historial',$expr$char_length(btrim(nota_interna)) >= 1 AND char_length(btrim(nota_interna)) <= 1000$expr$),
        ('reporte_historial',$expr$estado_anterior = 'Pendiente'::text AND (estado_nuevo = ANY (ARRAY['En_Revision'::text, 'Descartado'::text])) OR estado_anterior = 'En_Revision'::text AND (estado_nuevo = ANY (ARRAY['Resuelto'::text, 'Descartado'::text]))$expr$),
        ('operacion_envio',$expr$id_denunciante > 0$expr$),
        ('operacion_envio',$expr$clave::text ~ '^[A-Za-z0-9:_-]+$'::text$expr$)
    ) v(tab,definition) WHERE stage<>60 OR tab='reporte' LOOP
        IF NOT EXISTS (
            SELECT FROM pg_constraint WHERE conrelid=to_regclass('reportes.'||entity.tab)
                AND contype='c' AND convalidated AND NOT connoinherit
                AND replace(replace(pg_get_expr(conbin,conrelid,true),
                    '(clave)::text','clave::text'), 'clave ~', 'clave::text ~')
                    = entity.definition
        ) THEN RAISE EXCEPTION 'Definición CHECK inesperada en %',entity.tab; END IF;
    END LOOP;

    FOR entity IN SELECT * FROM (VALUES
        ('reporte_denunciante_fecha','reporte','(id_denunciante, fecha DESC, id_reporte DESC)'),
        ('reporte_fecha','reporte','(fecha DESC, id_reporte DESC)'),
        ('reporte_historial_orden','reporte_historial','(id_reporte, id_actuacion)'),
        ('reporte_outbox_pendiente','outbox','(proximo_intento, id_actuacion) WHERE (entregado_en IS NULL)')
    ) v(idx,tab,definition) WHERE stage<>60 OR tab='reporte' LOOP
        IF NOT EXISTS (SELECT FROM pg_index WHERE indexrelid=to_regclass('reportes.'||entity.idx)
            AND indrelid=to_regclass('reportes.'||entity.tab) AND indisvalid AND indisready
            AND pg_get_indexdef(indexrelid)='CREATE INDEX '||entity.idx||' ON reportes.'||entity.tab||' USING btree '||entity.definition)
        THEN RAISE EXCEPTION 'Índice inesperado: %', entity.idx; END IF;
    END LOOP;

    IF has_schema_privilege(runtime,ns,'USAGE') <> active OR
       has_schema_privilege(runtime,ns,'CREATE,USAGE WITH GRANT OPTION') OR EXISTS (
           SELECT FROM pg_namespace n CROSS JOIN LATERAL aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a
           WHERE n.oid=ns AND a.grantee NOT IN (owner_oid,runtime)
       )
    THEN RAISE EXCEPTION 'ACL de esquema inesperada'; END IF;

    FOR entity IN SELECT oid,relname,relkind,relacl,relforcerowsecurity,relrowsecurity FROM pg_class
        WHERE relnamespace=ns AND relkind IN ('r','S') LOOP
        IF EXISTS (SELECT FROM aclexplode(entity.relacl) a WHERE a.grantee NOT IN (owner_oid,runtime))
        THEN RAISE EXCEPTION 'ACL ajena sobre %',entity.relname; END IF;

        FOR role_row IN SELECT oid FROM pg_roles WHERE rolname IN
            ('sql_auth_users','sql_listado_applications','sql_match_conexion','sql_convivencia_mensajeria','sql_reportes') LOOP
            IF role_row.oid<>runtime AND has_schema_privilege(role_row.oid,ns,'USAGE,CREATE') THEN
                RAISE EXCEPTION 'Acceso cruzado al esquema';
            END IF;
            IF entity.relkind='S' THEN
                IF has_sequence_privilege(role_row.oid,entity.oid,'USAGE') <> (active AND role_row.oid=runtime)
                   OR has_sequence_privilege(role_row.oid,entity.oid,'SELECT,UPDATE,USAGE WITH GRANT OPTION')
                THEN RAISE EXCEPTION 'ACL de secuencia inesperada: %',entity.relname; END IF;
                CONTINUE;
            END IF;
            IF has_table_privilege(role_row.oid,entity.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
            THEN RAISE EXCEPTION 'Permiso general sobre %',entity.relname; END IF;
            FOR col IN SELECT attnum,attname FROM pg_attribute WHERE attrelid=entity.oid AND attnum>0 AND NOT attisdropped LOOP
                FOREACH privilege IN ARRAY ARRAY['SELECT','INSERT','UPDATE','REFERENCES'] LOOP
                    SELECT active AND role_row.oid=runtime AND EXISTS (
                        SELECT FROM (VALUES
                            ('reporte','SELECT','id_reporte,id_denunciante,id_usuario_reportado,id_publicacion_reportada,tipo,categoria,descripcion,estado,fecha'),
                            ('reporte','INSERT','id_denunciante,id_usuario_reportado,id_publicacion_reportada,categoria,descripcion'),
                            ('reporte','UPDATE','estado'),
                            ('reporte_historial','SELECT','id_actuacion,id_reporte,id_administrador,estado_anterior,estado_nuevo,nota_interna,fecha'),
                            ('reporte_historial','INSERT','id_reporte,id_administrador,estado_anterior,estado_nuevo,nota_interna'),
                            ('outbox','SELECT','id_actuacion,proximo_intento,entregado_en'),
                            ('outbox','INSERT','id_actuacion'),
                            ('outbox','UPDATE','proximo_intento,entregado_en'),
                            ('operacion_envio','SELECT','id_denunciante,clave,huella,respuesta'),
                            ('operacion_envio','INSERT','id_denunciante,clave,huella,respuesta')
                        ) v(tab,op,cols)
                        WHERE tab=entity.relname AND op=privilege AND col.attname::text=ANY(string_to_array(cols,','))
                    ) INTO expected;
                    IF has_column_privilege(role_row.oid,entity.oid,col.attnum,privilege) <> expected
                       OR has_column_privilege(role_row.oid,entity.oid,col.attnum,privilege||' WITH GRANT OPTION')
                    THEN RAISE EXCEPTION 'ACL inesperada %.% %',entity.relname,col.attname,privilege; END IF;
                END LOOP;
            END LOOP;
        END LOOP;

        IF entity.relkind='S' THEN CONTINUE; END IF;
        IF NOT entity.relrowsecurity OR entity.relforcerowsecurity OR EXISTS (
            SELECT FROM pg_attribute c CROSS JOIN LATERAL aclexplode(c.attacl) a
            WHERE c.attrelid=entity.oid AND a.grantee NOT IN (owner_oid,runtime)
        ) OR (SELECT count(*) FROM pg_policy WHERE polrelid=entity.oid) <>
            (CASE WHEN NOT active THEN 0 WHEN entity.relname IN ('reporte','outbox') THEN 3 ELSE 2 END)
        THEN RAISE EXCEPTION 'RLS o ACL de columna inesperada: %',entity.relname; END IF;

        IF active AND EXISTS (
            SELECT FROM pg_policy p WHERE p.polrelid=entity.oid AND (
                NOT p.polpermissive OR p.polroles<>ARRAY[runtime] OR
                (p.polcmd='r' AND p.polname='runtime_select' AND pg_get_expr(p.polqual,p.polrelid)='true' AND p.polwithcheck IS NULL
                    OR p.polcmd='a' AND p.polname='runtime_insert' AND p.polqual IS NULL AND pg_get_expr(p.polwithcheck,p.polrelid)='true'
                    OR p.polcmd='w' AND p.polname='runtime_update' AND entity.relname IN ('reporte','outbox')
                        AND pg_get_expr(p.polqual,p.polrelid)='true' AND pg_get_expr(p.polwithcheck,p.polrelid)='true') IS DISTINCT FROM true
            )
        ) THEN RAISE EXCEPTION 'Política inesperada: %',entity.relname; END IF;
    END LOOP;
END;
$verify$;
