DO $check$
DECLARE
    expected record;
    qualified text;
BEGIN
    FOR expected IN SELECT * FROM (VALUES
            ('usuario', 'id_usuario', 'bigint', true, 'd', NULL),
            ('usuario', 'supabase_user_id', 'uuid', true, '', NULL),
            ('usuario', 'nombre', 'character varying(200)', true, '', NULL),
            ('usuario', 'fecha_nacimiento', 'date', true, '', NULL),
            ('usuario', 'edad', 'smallint', false, '', NULL),
            ('usuario', 'ocupacion', 'character varying(100)', false, '', NULL),
            ('usuario', 'ciudad', 'character varying(100)', false, '', NULL),
            ('usuario', 'breve_descripcion', 'character varying(255)', false, '', NULL),
            ('usuario', 'sobre_mi', 'character varying(5000)', false, '', NULL),
            ('usuario', 'foto_perfil', 'text', false, '', NULL),
            ('usuario', 'presupuesto', 'integer', false, '', NULL),
            ('usuario', 'zona_interes', 'character varying(250)', false, '', NULL),
            ('notificacion', 'id', 'bigint', true, 'a', NULL),
            ('notificacion', 'id_usuario', 'bigint', true, '', NULL),
            ('notificacion', 'event_key', 'character varying(150)', true, '', NULL),
            ('notificacion', 'tipo', 'character varying(50)', true, '', NULL),
            ('notificacion', 'referencia_id', 'bigint', true, '', NULL),
            ('notificacion', 'estado', 'character varying(20)', true, '', NULL),
            ('notificacion', 'creado_en', 'timestamp with time zone', true, '', 'clock_timestamp()'),
            ('sesion_revocada', 'session_id', 'uuid', true, '', NULL),
            ('sesion_revocada', 'subject', 'uuid', true, '', NULL),
            ('sesion_revocada', 'revocada_en', 'timestamp with time zone', true, '', 'clock_timestamp()'),
            ('perfil_comun', 'supabase_user_id', 'uuid', true, '', NULL),
            ('perfil_comun', 'genero', 'text', false, '', NULL),
            ('perfil_comun', 'id_region_interes', 'integer', false, '', NULL),
            ('perfil_comun', 'id_comuna_interes', 'integer', false, '', NULL),
            ('foto_limpieza', 'reference', 'text', true, '', NULL),
            ('foto_limpieza', 'subject', 'uuid', true, '', NULL),
            ('foto_limpieza', 'creada_en', 'timestamp with time zone', true, '', 'clock_timestamp()')
    ) AS spec(table_name, column_name, column_type, required, identity_kind, default_sql)
    LOOP
        qualified := 'auth_users.' || expected.table_name;
        IF NOT EXISTS (
            SELECT FROM pg_attribute a JOIN pg_class c ON c.oid = a.attrelid
            LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
            WHERE c.oid = to_regclass(qualified) AND c.relkind = 'r'
              AND c.relowner = 'scrum101_owner'::regrole
              AND a.attnum > 0 AND NOT a.attisdropped AND a.attname = expected.column_name
              AND format_type(a.atttypid, a.atttypmod) = expected.column_type
              AND a.attnotnull = expected.required AND a.attidentity::text = expected.identity_kind
              AND pg_get_expr(d.adbin, d.adrelid) IS NOT DISTINCT FROM expected.default_sql
        ) THEN
            RAISE EXCEPTION 'SCRUM-101: columna, tipo, default o propietario inesperado: %.%',
                qualified, expected.column_name;
        END IF;
    END LOOP;

    FOR expected IN SELECT * FROM (VALUES
        ('usuario', 'PRIMARY KEY (id_usuario)'),
        ('usuario', 'UNIQUE (supabase_user_id)'),
        ('notificacion', 'PRIMARY KEY (id)'),
        ('notificacion', 'UNIQUE (event_key)'),
        ('notificacion', 'FOREIGN KEY (id_usuario) REFERENCES auth_users.usuario(id_usuario)'),
        ('sesion_revocada', 'PRIMARY KEY (session_id)'),
        ('sesion_revocada', 'FOREIGN KEY (subject) REFERENCES auth_users.usuario(supabase_user_id)'),
        ('perfil_comun', 'PRIMARY KEY (supabase_user_id)'),
        ('foto_limpieza', 'PRIMARY KEY (reference)')
    ) AS spec(table_name, definition)
    LOOP
        IF NOT EXISTS (
            SELECT FROM pg_constraint
            WHERE conrelid = to_regclass('auth_users.' || expected.table_name)
              AND convalidated AND pg_get_constraintdef(oid) = expected.definition
        ) THEN
            RAISE EXCEPTION 'SCRUM-101: restricción ausente en %: %', expected.table_name, expected.definition;
        END IF;
    END LOOP;

    FOR expected IN SELECT * FROM (VALUES
        ('usuario', 'nombre'), ('usuario', 'edad'), ('usuario', 'presupuesto'),
        ('perfil_comun', 'genero'), ('perfil_comun', 'id_region_interes'), ('perfil_comun', 'id_comuna_interes')
    ) AS spec(table_name, column_name)
    LOOP
        IF NOT EXISTS (
            SELECT FROM pg_constraint k JOIN pg_attribute a
              ON a.attrelid = k.conrelid AND a.attnum = ANY(k.conkey)
            WHERE k.conrelid = to_regclass('auth_users.' || expected.table_name)
              AND k.contype = 'c' AND k.convalidated AND a.attname = expected.column_name
        ) THEN
            RAISE EXCEPTION 'SCRUM-101: falta CHECK en %.%', expected.table_name, expected.column_name;
        END IF;
    END LOOP;

    IF NOT EXISTS (
        SELECT FROM pg_constraint
        WHERE conrelid = 'auth_users.perfil_comun'::regclass AND contype = 'c'
          AND convalidated AND array_length(conkey, 1) = 2
          AND pg_get_constraintdef(oid) LIKE '%id_comuna_interes IS NULL%id_region_interes IS NOT NULL%'
    ) THEN
        RAISE EXCEPTION 'SCRUM-101: falta la dependencia de comuna respecto de región';
    END IF;

    IF pg_get_serial_sequence('auth_users.usuario', 'id_usuario') IS DISTINCT FROM 'auth_users.usuario_id_usuario_seq'
       OR pg_get_serial_sequence('auth_users.notificacion', 'id') IS DISTINCT FROM 'auth_users.notificacion_id_seq'
       OR EXISTS (SELECT FROM pg_proc WHERE pronamespace = 'auth_users'::regnamespace)
       OR (SELECT count(*) FROM pg_class WHERE relnamespace = 'auth_users'::regnamespace
           AND relkind IN ('r', 'p', 'v', 'm', 'f', 'S')) <> 7 THEN
        RAISE EXCEPTION 'SCRUM-101: secuencias u objetos Auth inesperados';
    END IF;
END;
$check$;
