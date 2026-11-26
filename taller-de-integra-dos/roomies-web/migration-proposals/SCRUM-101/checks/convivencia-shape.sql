-- Internal catalog verifier, called before and after each stage and by read-only entrypoints.
DO $check$
DECLARE
    stage integer := current_setting('scrum101.convivencia_stage')::integer;
    ns oid := to_regnamespace('convivencia_mensajeria');
    owner_role oid := 'scrum101_owner'::regrole;
    tbl oid;
    seq oid;
    fn oid;
    item record;
    runtime record;
    cols text[];
BEGIN
    IF stage = 0 THEN
        IF ns IS NOT NULL THEN
            RAISE EXCEPTION 'SCRUM-101: esquema de Convivencia preexistente';
        END IF;
        RETURN;
    END IF;
    IF stage NOT BETWEEN 1 AND 3 OR NOT EXISTS (
        SELECT FROM pg_namespace WHERE oid = ns AND nspowner = owner_role
    ) OR EXISTS (
        SELECT FROM pg_namespace n, LATERAL aclexplode(COALESCE(n.nspacl, acldefault('n', n.nspowner))) a
        WHERE n.oid = ns AND (a.grantee <> owner_role OR a.grantor <> owner_role)
    ) THEN
        RAISE EXCEPTION 'SCRUM-101: esquema, propietario o ACL de esquema inesperados';
    END IF;
    IF (SELECT count(*) FROM pg_class WHERE relnamespace = ns AND relkind = 'r')
         <> (CASE WHEN stage = 3 THEN 6 ELSE 4 END)
       OR (SELECT count(*) FROM pg_class WHERE relnamespace = ns AND relkind = 'S')
         <> (CASE WHEN stage = 3 THEN 5 ELSE 3 END)
       OR EXISTS (SELECT FROM pg_class WHERE relnamespace = ns
                  AND (relkind NOT IN ('r','i','S') OR relowner <> owner_role OR relrowsecurity OR relforcerowsecurity))
       OR EXISTS (SELECT FROM pg_policy p JOIN pg_class c ON c.oid = p.polrelid WHERE c.relnamespace = ns)
    THEN
        RAISE EXCEPTION 'SCRUM-101: inventario, propietario o RLS prematuro';
    END IF;

    FOR item IN SELECT * FROM (VALUES
        ('incorporacion', 1, ARRAY['id_operacion:uuid','payload:jsonb','etapa:text','estado:text','http_status:smallint?','respuesta:jsonb?','creada_en:timestamp with time zone','ultimo_intento:timestamp with time zone?'], 'id_operacion', 4,
         ARRAY[]::text[], ARRAY[]::text[]),
        ('arriendo', 1, ARRAY['id_arriendo:bigint!','id_publicacion:bigint','cupos_totales:bigint','version_capacidad:bigint','creado_en:timestamp with time zone'], 'id_arriendo', 3,
         ARRAY['UNIQUE (id_publicacion)'], ARRAY[]::text[]),
        ('pertenencia', 1, ARRAY['id_pertenencia:bigint!','id_arriendo:bigint','id_usuario:bigint','id_postulacion:bigint','id_operacion:uuid','estado:text','creada_en:timestamp with time zone'], 'id_pertenencia', 3,
         ARRAY['UNIQUE (id_operacion)','UNIQUE (id_postulacion)'], ARRAY['FOREIGN KEY (id_arriendo) REFERENCES convivencia_mensajeria.arriendo(id_arriendo)','FOREIGN KEY (id_operacion) REFERENCES convivencia_mensajeria.incorporacion(id_operacion)']),
        ('outbox', 1, ARRAY['id_outbox:bigint!','id_operacion:uuid','accion:text','reserva:jsonb','enviado:boolean','ultimo_intento:timestamp with time zone?'], 'id_outbox', 2,
         ARRAY['UNIQUE (id_operacion, accion)'], ARRAY['FOREIGN KEY (id_operacion) REFERENCES convivencia_mensajeria.incorporacion(id_operacion)']),
        ('conversacion', 3, ARRAY['id_conversacion:bigint!','id_arriendo:bigint','creada_en:timestamp with time zone'], 'id_conversacion', 0,
         ARRAY['UNIQUE (id_arriendo)'], ARRAY['FOREIGN KEY (id_arriendo) REFERENCES convivencia_mensajeria.arriendo(id_arriendo)']),
        ('mensaje', 3, ARRAY['id_mensaje:bigint!','id_conversacion:bigint','id_remitente:bigint','nombre_remitente:text','contenido:character varying(2000)','id_cliente:uuid','fecha_envio:timestamp with time zone'], 'id_mensaje', 3,
         ARRAY['UNIQUE (id_conversacion, id_remitente, id_cliente)'], ARRAY['FOREIGN KEY (id_conversacion) REFERENCES convivencia_mensajeria.conversacion(id_conversacion)'])
    ) v(name, first_stage, columns, pk, checks, uniques, foreign_keys) WHERE first_stage <= stage LOOP
        tbl := to_regclass('convivencia_mensajeria.' || item.name);
        cols := item.columns;
        IF stage >= 2 AND item.name = 'arriendo' THEN
            cols := array_append(cols, 'version_ocupacion:bigint');
            item.checks := item.checks + 1;
        ELSIF stage >= 2 AND item.name = 'pertenencia' THEN
            cols := array_append(cols, 'terminada_en:timestamp with time zone?');
            item.checks := item.checks + 1;
        END IF;
        IF NOT EXISTS (SELECT FROM pg_class WHERE oid = tbl AND relkind = 'r')
           OR (SELECT array_agg(attname::text || ':' || format_type(atttypid, atttypmod)
                   || CASE WHEN NOT attnotnull THEN '?' WHEN attidentity = 'a' THEN '!' ELSE '' END ORDER BY attnum)
               FROM pg_attribute WHERE attrelid = tbl AND attnum > 0 AND NOT attisdropped) IS DISTINCT FROM cols
           OR (SELECT count(*) FROM pg_constraint WHERE conrelid = tbl AND contype = 'c') <> item.checks
           OR (SELECT count(*) FROM pg_constraint WHERE conrelid = tbl AND contype = 'p'
               AND pg_get_constraintdef(oid) = 'PRIMARY KEY (' || item.pk || ')') <> 1
           OR (SELECT count(*) FROM pg_constraint WHERE conrelid = tbl AND contype IN ('u','f'))
                <> cardinality(item.uniques) + cardinality(item.foreign_keys)
           OR (SELECT count(*) FROM pg_constraint WHERE conrelid = tbl AND contype IN ('u','f')
               AND pg_get_constraintdef(oid) = ANY(item.uniques || item.foreign_keys))
                <> cardinality(item.uniques) + cardinality(item.foreign_keys)
           OR EXISTS (SELECT FROM pg_constraint WHERE conrelid = tbl
                      AND (NOT convalidated OR condeferrable OR contype NOT IN ('p','u','f','c')))
        THEN
            RAISE EXCEPTION 'SCRUM-101: contrato de columnas o restricciones inesperado para %', item.name;
        END IF;
        IF item.name <> 'incorporacion' THEN
            seq := to_regclass('convivencia_mensajeria.' || item.name || '_' || item.pk || '_seq');
            IF to_regclass(pg_get_serial_sequence('convivencia_mensajeria.' || item.name, item.pk))
                 IS DISTINCT FROM seq OR NOT EXISTS (
                   SELECT FROM pg_sequence WHERE seqrelid = seq AND seqtypid = 'bigint'::regtype
                     AND (seqstart, seqincrement, seqmin, seqmax, seqcache, seqcycle)
                         = (1, 1, 1, 9223372036854775807, 1, false)
                 ) OR NOT EXISTS (
                   SELECT FROM pg_depend d JOIN pg_attribute a
                     ON a.attrelid = d.refobjid AND a.attnum = d.refobjsubid
                   WHERE d.classid = 'pg_class'::regclass AND d.refclassid = 'pg_class'::regclass
                     AND d.objid = seq AND d.objsubid = 0 AND d.refobjid = tbl
                     AND d.deptype = 'i' AND a.attname = item.pk AND a.attidentity = 'a'
                 ) THEN
                RAISE EXCEPTION 'SCRUM-101: identidad inesperada para %', item.name;
            END IF;
        END IF;
    END LOOP;

    FOR item IN SELECT * FROM (VALUES
        ('incorporacion','etapa',1,$d$'ValidarIdentidad'::text$d$),
        ('incorporacion','estado',1,$d$'Pendiente'::text$d$),
        ('incorporacion','creada_en',1,'clock_timestamp()'),
        ('arriendo','creado_en',1,'clock_timestamp()'),
        ('arriendo','version_ocupacion',2,'0'),
        ('pertenencia','estado',1,$d$'Activa'::text$d$),
        ('pertenencia','creada_en',1,'clock_timestamp()'),
        ('outbox','enviado',1,'false'),
        ('conversacion','creada_en',3,'clock_timestamp()'),
        ('mensaje','fecha_envio',3,'clock_timestamp()')
    ) v(parent, column_name, first_stage, default_value) WHERE first_stage <= stage LOOP
        IF NOT EXISTS (
            SELECT FROM pg_attrdef d JOIN pg_attribute a ON a.attrelid = d.adrelid AND a.attnum = d.adnum
            WHERE d.adrelid = to_regclass('convivencia_mensajeria.' || item.parent)
              AND a.attname = item.column_name
              AND (pg_get_expr(d.adbin, d.adrelid) = item.default_value
                   OR (item.default_value = '0' AND pg_get_expr(d.adbin, d.adrelid) IN ($d$'0'::bigint$d$, '(0)::bigint')))
        ) THEN
            RAISE EXCEPTION 'SCRUM-101: default inesperado: %.%', item.parent, item.column_name;
        END IF;
    END LOOP;
    IF (SELECT count(*) FROM pg_attrdef d JOIN pg_class c ON c.oid = d.adrelid WHERE c.relnamespace = ns)
         <> (CASE stage WHEN 1 THEN 7 WHEN 2 THEN 8 ELSE 10 END) THEN
        RAISE EXCEPTION 'SCRUM-101: defaults adicionales';
    END IF;

    -- Compare complete PostgreSQL 17 deparser output. Only the implicit varchar-to-text
    -- cast on mensaje.contenido has accepted display variants.
    FOR item IN SELECT * FROM (VALUES
        ('incorporacion',1,$expr$jsonb_typeof(payload) = 'object'::text$expr$),
        ('incorporacion',1,$expr$etapa = ANY (ARRAY['ValidarIdentidad'::text, 'Reservar'::text])$expr$),
        ('incorporacion',1,$expr$estado = ANY (ARRAY['Pendiente'::text, 'Terminada'::text, 'Rechazada'::text])$expr$),
        ('incorporacion',1,$expr$estado = 'Pendiente'::text AND http_status IS NULL AND respuesta IS NULL OR estado = 'Terminada'::text AND http_status IS NOT NULL AND http_status = 201 AND respuesta IS NOT NULL OR estado = 'Rechazada'::text AND http_status IS NOT NULL AND http_status >= 400 AND http_status <= 499 AND respuesta IS NOT NULL$expr$),
        ('arriendo',1,$expr$id_publicacion > 0$expr$),
        ('arriendo',1,$expr$cupos_totales > 0$expr$),
        ('arriendo',1,$expr$version_capacidad > 0$expr$),
        ('arriendo',2,$expr$version_ocupacion >= 0$expr$),
        ('pertenencia',1,$expr$id_usuario > 0$expr$),
        ('pertenencia',1,$expr$id_postulacion > 0$expr$),
        ('pertenencia',1,$expr$estado = ANY (ARRAY['Activa'::text, 'Inactiva'::text])$expr$),
        ('pertenencia',2,$expr$terminada_en IS NULL OR estado = 'Inactiva'::text AND terminada_en >= creada_en$expr$),
        ('outbox',1,$expr$accion = ANY (ARRAY['Confirmar'::text, 'Liberar'::text])$expr$),
        ('outbox',1,$expr$jsonb_typeof(reserva) = 'object'::text$expr$),
        ('mensaje',3,$expr$id_remitente > 0$expr$),
        ('mensaje',3,$expr$length(btrim(nombre_remitente)) >= 1 AND length(btrim(nombre_remitente)) <= 200$expr$),
        ('mensaje',3,$expr$length(btrim(contenido::text)) >= 1 AND length(btrim(contenido::text)) <= 2000$expr$)
    ) v(parent, first_stage, expression) WHERE first_stage <= stage LOOP
        IF NOT EXISTS (
            SELECT FROM pg_constraint WHERE conrelid = to_regclass('convivencia_mensajeria.' || item.parent)
              AND contype = 'c'
              AND replace(replace(pg_get_expr(conbin, conrelid, true),
                    'btrim((contenido)::text)', 'btrim(contenido::text)'),
                    'btrim(contenido)', 'btrim(contenido::text)') = item.expression
        ) THEN
            RAISE EXCEPTION 'SCRUM-101: CHECK inesperado en %', item.parent;
        END IF;
    END LOOP;

    FOR item IN SELECT * FROM (VALUES
        ('una_pertenencia_activa_por_usuario','pertenencia',1,'id_usuario',NULL,true,$expr$estado = 'Activa'::text$expr$),
        ('pertenencia_ocupacion','pertenencia',1,'id_arriendo',NULL,false,$expr$estado = 'Activa'::text$expr$),
        ('incorporaciones_pendientes','incorporacion',1,'ultimo_intento NULLS FIRST','creada_en',false,$expr$estado = 'Pendiente'::text$expr$),
        ('outbox_pendiente','outbox',1,'ultimo_intento NULLS FIRST','id_outbox',false,'NOT enviado'),
        ('pertenencia_relacion','pertenencia',2,'id_usuario','id_arriendo',false,NULL),
        ('mensajes_historial','mensaje',3,'id_conversacion','id_mensaje DESC',false,NULL)
    ) v(name, parent, first_stage, key1, key2, unique_index, predicate) WHERE first_stage <= stage LOOP
        IF NOT EXISTS (
            SELECT FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
            JOIN pg_am am ON am.oid = c.relam
            WHERE c.relnamespace = ns AND c.relname = item.name
            AND i.indrelid = to_regclass('convivencia_mensajeria.' || item.parent)
            AND am.amname = 'btree' AND i.indisvalid AND i.indisready AND i.indislive
            AND i.indisunique = item.unique_index AND NOT i.indnullsnotdistinct
            AND i.indimmediate AND i.indexprs IS NULL AND i.indnkeyatts = i.indnatts
            AND i.indnatts = CASE WHEN item.key2 IS NULL THEN 1 ELSE 2 END
            AND (SELECT attname::text FROM pg_attribute WHERE attrelid = i.indrelid AND attnum = i.indkey[0])
                = split_part(item.key1, ' ', 1)
            AND (item.key2 IS NULL OR (SELECT attname::text FROM pg_attribute
                WHERE attrelid = i.indrelid AND attnum = i.indkey[1]) = split_part(item.key2, ' ', 1))
            AND i.indoption[0] = CASE WHEN item.key1 LIKE '%NULLS FIRST' THEN 2 ELSE 0 END
            AND (item.key2 IS NULL OR i.indoption[1] = CASE WHEN item.key2 LIKE '%DESC' THEN 3 ELSE 0 END)
            AND pg_get_expr(i.indpred, i.indrelid, true) IS NOT DISTINCT FROM item.predicate
            AND NOT EXISTS (SELECT FROM unnest(i.indcollation) AS key(collation_oid) WHERE key.collation_oid <> 0)
            AND NOT EXISTS (
                SELECT FROM unnest(i.indclass) AS key(opclass)
                JOIN pg_opclass op ON op.oid = key.opclass WHERE NOT op.opcdefault
            )
        ) THEN
            RAISE EXCEPTION 'SCRUM-101: índice inesperado o ausente: %', item.name;
        END IF;
    END LOOP;
    IF (SELECT count(*) FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid WHERE c.relnamespace = ns)
         <> (CASE stage WHEN 1 THEN 12 WHEN 2 THEN 13 ELSE 18 END)
       OR EXISTS (SELECT FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
                  WHERE c.relnamespace = ns AND (NOT i.indisvalid OR NOT i.indisready))
    THEN
        RAISE EXCEPTION 'SCRUM-101: cantidad o estado inesperado de índices';
    END IF;

    -- prosrc is compared with the approved function source, trimming outer whitespace only.
    -- Trigger attachment is checked by catalog identity instead of rendered qualified names.
    FOR item IN SELECT * FROM (VALUES
        ('validar_cupo','pertenencia_capacidad',1,23,NULL,'search_path=pg_catalog, convivencia_mensajeria',$body$
DECLARE capacidad BIGINT; ocupados BIGINT;
BEGIN
  IF NEW.estado='Activa' THEN
    SELECT cupos_totales INTO capacidad FROM convivencia_mensajeria.arriendo
      WHERE id_arriendo=NEW.id_arriendo FOR UPDATE;
    SELECT count(*) INTO ocupados FROM convivencia_mensajeria.pertenencia
      WHERE id_arriendo=NEW.id_arriendo AND estado='Activa'
      AND id_pertenencia<>NEW.id_pertenencia;
    IF ocupados>=capacidad THEN
      RAISE EXCEPTION 'Capacidad agotada' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END
$body$),
        ('registrar_fin_pertenencia','registrar_fin_pertenencia',2,19,'estado','search_path=pg_catalog, pg_temp',$body$
BEGIN
    IF OLD.estado = 'Activa' AND NEW.estado = 'Inactiva' THEN
        NEW.terminada_en := COALESCE(NEW.terminada_en, clock_timestamp());
    END IF;
    RETURN NEW;
END
$body$)
    ) v(function_name, trigger_name, first_stage, event_mask, update_column, search_path_setting, body)
      WHERE first_stage <= stage LOOP
        fn := to_regprocedure('convivencia_mensajeria.' || item.function_name || '()');
        IF NOT EXISTS (
             SELECT FROM pg_proc p JOIN pg_language l ON l.oid = p.prolang
             WHERE p.oid = fn AND p.proowner = owner_role AND NOT p.prosecdef
             AND l.lanname = 'plpgsql' AND p.prorettype = 'trigger'::regtype
             AND p.proconfig = ARRAY[item.search_path_setting]
             AND p.provolatile = 'v' AND NOT p.proisstrict AND NOT p.proleakproof AND p.proparallel = 'u'
             AND btrim(p.prosrc, E' \t\r\n') = btrim(item.body, E' \t\r\n')
           ) OR NOT EXISTS (
             SELECT FROM pg_trigger t WHERE t.tgrelid = 'convivencia_mensajeria.pertenencia'::regclass
             AND t.tgname = item.trigger_name AND t.tgfoid = fn AND t.tgenabled = 'O'
             AND NOT t.tgisinternal AND t.tgtype = item.event_mask AND t.tgnargs = 0
             AND t.tgqual IS NULL AND t.tgconstraint = 0 AND t.tgconstrrelid = 0
             AND NOT t.tgdeferrable AND NOT t.tginitdeferred
             AND t.tgoldtable IS NULL AND t.tgnewtable IS NULL
             AND t.tgattr::text = CASE WHEN item.update_column IS NULL THEN '' ELSE (
                 SELECT attnum::text FROM pg_attribute
                 WHERE attrelid = t.tgrelid AND attname = item.update_column AND NOT attisdropped
             ) END
           ) THEN
            RAISE EXCEPTION 'SCRUM-101: función o trigger inesperado: %', item.trigger_name;
        END IF;
    END LOOP;
    IF (SELECT count(*) FROM pg_proc WHERE pronamespace = ns) <> LEAST(stage, 2)
       OR (SELECT count(*) FROM pg_trigger t JOIN pg_class c ON c.oid = t.tgrelid
           WHERE c.relnamespace = ns AND NOT t.tgisinternal) <> LEAST(stage, 2)
    THEN
        RAISE EXCEPTION 'SCRUM-101: funciones o triggers adicionales';
    END IF;

    IF EXISTS (
        SELECT FROM pg_class c, LATERAL aclexplode(COALESCE(c.relacl, acldefault(
            CASE WHEN c.relkind = 'S' THEN 's'::"char" ELSE 'r'::"char" END, c.relowner))) a
        WHERE c.relnamespace = ns AND c.relkind IN ('r','S')
          AND (a.grantee <> owner_role OR a.grantor <> owner_role)
    ) OR EXISTS (
        SELECT FROM pg_attribute att JOIN pg_class c ON c.oid = att.attrelid,
            LATERAL aclexplode(att.attacl) a WHERE c.relnamespace = ns
              AND (a.grantee <> owner_role OR a.grantor <> owner_role)
    ) OR EXISTS (
        SELECT FROM pg_proc p, LATERAL aclexplode(COALESCE(p.proacl, acldefault('f', p.proowner))) a
        WHERE p.pronamespace = ns AND (a.grantee <> owner_role OR a.grantor <> owner_role)
    ) THEN
        RAISE EXCEPTION 'SCRUM-101: ACL explícita o predeterminada fuera del propietario';
    END IF;
    FOR runtime IN SELECT oid, rolname FROM pg_roles WHERE rolname IN (
        'sql_auth_users','sql_listado_applications','sql_match_conexion','sql_convivencia_mensajeria','sql_reportes'
    ) LOOP
        IF has_schema_privilege(runtime.oid, ns, 'USAGE,CREATE') OR EXISTS (
            SELECT FROM pg_class WHERE relnamespace = ns AND CASE relkind
                WHEN 'r' THEN has_table_privilege(runtime.oid, oid, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER,MAINTAIN')
                           OR has_any_column_privilege(runtime.oid, oid, 'SELECT,INSERT,UPDATE,REFERENCES')
                WHEN 'S' THEN has_sequence_privilege(runtime.oid, oid, 'USAGE,SELECT,UPDATE')
                ELSE false END
        ) OR EXISTS (
            SELECT FROM pg_proc p WHERE p.pronamespace = ns AND has_function_privilege(runtime.oid, p.oid, 'EXECUTE')
        ) THEN
            RAISE EXCEPTION 'SCRUM-101: acceso prematuro de %', runtime.rolname;
        END IF;
    END LOOP;

    IF stage = 2 THEN
        IF EXISTS (
            SELECT FROM convivencia_mensajeria.arriendo a WHERE a.version_ocupacion <> (
                SELECT count(*) FROM convivencia_mensajeria.pertenencia p WHERE p.id_arriendo = a.id_arriendo
            )
        ) THEN
            RAISE EXCEPTION 'SCRUM-101: inicialización de versión de ocupación incorrecta';
        END IF;
    ELSIF stage = 3 THEN
        IF EXISTS (
            SELECT FROM convivencia_mensajeria.arriendo a WHERE NOT EXISTS (
                SELECT FROM convivencia_mensajeria.conversacion c WHERE c.id_arriendo = a.id_arriendo
            )
        ) THEN
            RAISE EXCEPTION 'SCRUM-101: backfill de conversaciones incompleto';
        END IF;
    END IF;
END;
$check$;
