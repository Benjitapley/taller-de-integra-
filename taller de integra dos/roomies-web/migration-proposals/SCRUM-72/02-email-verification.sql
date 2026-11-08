-- BORRADOR V2: validado solo en PostgreSQL desechable. NO EJECUTADO EN SUPABASE.
-- Solo creación inicial: aborta si una versión anterior ya existe.
-- Antes de una ejecución AUTORIZADA, configurar en la misma sesión:
-- SET haycupo.jwt_backend_role = 'nombre_del_rol_aprobado';
-- Si las tablas existentes tienen RLS, auditar sus políticas y declarar:
-- SET haycupo.jwt_existing_rls_reviewed = 'yes';
-- Ninguno de estos parámetros contiene passwords o secretos JWT/HMAC.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $migration$
DECLARE
    usuario_oid oid;
    id_attnum smallint;
    tipo_id text;
    id_not_null boolean;
    app_role text := nullif(current_setting('haycupo.jwt_backend_role', true), '');
    role_oid oid;
    object_name text;
    principal record;
    column_spec record;
    seq_name text;
BEGIN
    IF current_setting('server_version_num')::integer < 120000 THEN
        RAISE EXCEPTION 'Esta propuesta requiere PostgreSQL 12 o posterior.';
    END IF;
    -- No crear roles ni suponer credenciales o nombres de proveedores.
    SELECT oid INTO role_oid FROM pg_roles
    WHERE rolname = app_role AND NOT rolsuper AND NOT rolbypassrls;
    IF role_oid IS NULL OR app_role IN ('anon', 'authenticated', 'service_role', 'authenticator') THEN
        RAISE EXCEPTION 'Indicar jwt_backend_role existente, dedicado, no superuser ni BYPASSRLS.';
    END IF;
    IF pg_has_role(app_role, current_user, 'MEMBER') THEN
        RAISE EXCEPTION 'El rol de aplicación no debe heredar al propietario de los objetos nuevos.';
    END IF;
    FOR principal IN SELECT rolname FROM pg_roles WHERE rolsuper OR rolbypassrls LOOP
        IF pg_has_role(app_role, principal.rolname, 'MEMBER') THEN
            RAISE EXCEPTION 'El rol backend podría asumir un rol privilegiado. Revisar membresías.';
        END IF;
    END LOOP;
    FOR principal IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'authenticator') LOOP
        IF pg_has_role(principal.rolname, app_role, 'MEMBER') THEN
            RAISE EXCEPTION 'Un rol de cliente podría asumir el rol backend. Revisar membresías.';
        END IF;
    END LOOP;
    IF NOT has_schema_privilege(app_role, 'haycupo', 'USAGE') THEN
        RAISE EXCEPTION 'El rol backend necesita USAGE en el esquema existente; revisar por separado.';
    END IF;

    FOREACH object_name IN ARRAY ARRAY['usuario', 'publicacion', 'imagen_publicacion', 'conexion'] LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            WHERE n.nspname = 'haycupo' AND c.relname = object_name AND c.relkind = 'r'
        ) THEN
            RAISE EXCEPTION 'Falta tabla ordinaria haycupo.%: no crear/reemplazar tablas existentes.', object_name;
        END IF;
        IF NOT has_table_privilege(app_role, format('haycupo.%I', object_name), 'SELECT')
           OR NOT has_table_privilege(app_role, format('haycupo.%I', object_name), 'INSERT')
           OR NOT has_table_privilege(app_role, format('haycupo.%I', object_name), 'UPDATE') THEN
            RAISE EXCEPTION 'Revisar permisos previos SELECT/INSERT/UPDATE sobre haycupo.%.', object_name;
        END IF;
        IF object_name IN ('publicacion', 'imagen_publicacion')
           AND NOT has_table_privilege(app_role, format('haycupo.%I', object_name), 'DELETE') THEN
            RAISE EXCEPTION 'Revisar DELETE previo sobre haycupo.%.', object_name;
        END IF;
    END LOOP;
    IF EXISTS (
        SELECT 1 FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'haycupo' AND c.relname IN ('usuario','publicacion','imagen_publicacion','conexion')
          AND c.relrowsecurity
    ) AND current_setting('haycupo.jwt_existing_rls_reviewed', true) IS DISTINCT FROM 'yes' THEN
        RAISE EXCEPTION 'Auditar RLS existente y confirmar jwt_existing_rls_reviewed antes de migrar.';
    END IF;

    LOCK TABLE haycupo.usuario IN ACCESS EXCLUSIVE MODE;
    usuario_oid := 'haycupo.usuario'::regclass;
    IF EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = usuario_oid AND attname = 'verificado' AND attnum > 0 AND NOT attisdropped)
       OR to_regclass('haycupo.codigo_verificacion') IS NOT NULL
       OR to_regclass('haycupo.sesion_jwt') IS NOT NULL THEN
        RAISE EXCEPTION 'Ya existe parte del esquema JWT. No sobrescribir: inspeccionar y preparar actualización específica.';
    END IF;

    SELECT a.attnum, a.attnotnull,
           CASE a.atttypid
               WHEN 'pg_catalog.int2'::regtype THEN 'smallint'
               WHEN 'pg_catalog.int4'::regtype THEN 'integer'
               WHEN 'pg_catalog.int8'::regtype THEN 'bigint'
           END
    INTO id_attnum, id_not_null, tipo_id
    FROM pg_attribute a WHERE a.attrelid = usuario_oid AND a.attname = 'id_usuario'
      AND a.attnum > 0 AND NOT a.attisdropped;
    IF tipo_id IS NULL OR id_not_null IS DISTINCT FROM true THEN
        RAISE EXCEPTION 'id_usuario debe ser entero builtin NOT NULL; no se cambia su tipo ni sus valores.';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conrelid = usuario_oid AND contype IN ('p','u')
        AND conkey = ARRAY[id_attnum] AND convalidated AND NOT condeferrable
    ) THEN
        RAISE EXCEPTION 'Revisar PK/UNIQUE unicolumna no diferible de usuario.id_usuario.';
    END IF;
    IF NOT EXISTS (
        SELECT 1 FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
        WHERE a.attrelid = usuario_oid AND a.attnum = id_attnum
          AND (a.attidentity <> '' OR d.adbin IS NOT NULL)
    ) THEN
        RAISE EXCEPTION 'El registro omite id_usuario: falta identidad/default de generación. Revisar sin modificarlo.';
    END IF;

    -- Sin cambios automáticos de tipos existentes: abortar si no caben entradas.
    -- 97 = longitud Argon2id actual (m=65536,t=3,p=4,salt=16,hash=32).
    FOR column_spec IN SELECT * FROM (VALUES ('nombre',200), ('correo',254), ('contrasena',97)) AS required(col, capacity) LOOP
        IF NOT EXISTS (
            SELECT 1 FROM pg_attribute a WHERE a.attrelid = usuario_oid AND a.attname = column_spec.col
              AND a.attnum > 0 AND NOT a.attisdropped
              AND (a.atttypid = 'pg_catalog.text'::regtype
                   OR (a.atttypid = 'pg_catalog.varchar'::regtype AND (a.atttypmod = -1 OR a.atttypmod - 4 >= column_spec.capacity)))
        ) THEN
            RAISE EXCEPTION 'Revisar tipo/capacidad de usuario.%; no se altera automáticamente.', column_spec.col;
        END IF;
    END LOOP;
    IF NOT EXISTS (SELECT 1 FROM pg_attribute WHERE attrelid = usuario_oid AND attname = 'fecha_nacimiento'
                   AND atttypid = 'pg_catalog.date'::regtype AND attnum > 0 AND NOT attisdropped) THEN
        RAISE EXCEPTION 'Revisar usuario.fecha_nacimiento: el contrato requiere DATE.';
    END IF;
    IF EXISTS (
        SELECT 1 FROM pg_attribute a LEFT JOIN pg_attrdef d ON d.adrelid = a.attrelid AND d.adnum = a.attnum
        WHERE a.attrelid = usuario_oid AND a.attnum > 0 AND NOT a.attisdropped AND a.attnotnull
          AND a.attname NOT IN ('id_usuario','nombre','correo','contrasena','fecha_nacimiento')
          AND a.attidentity = '' AND a.attgenerated = '' AND d.adbin IS NULL
    ) THEN
        RAISE EXCEPTION 'Hay columnas NOT NULL sin default que el registro no informa. Revisar preflight.';
    END IF;
    IF EXISTS (SELECT 1 FROM haycupo.usuario WHERE id_usuario <= 0) THEN
        RAISE EXCEPTION 'Hay IDs incompatibles con sub positivo. No se renumeran usuarios.';
    END IF;
    IF EXISTS (
        SELECT lower(btrim(correo)) FROM haycupo.usuario
        WHERE correo IS NOT NULL AND btrim(correo) <> ''
        GROUP BY lower(btrim(correo)) HAVING count(*) > 1
    ) THEN
        RAISE EXCEPTION 'Hay correos normalizados duplicados. No se fusionan ni eliminan cuentas.';
    END IF;

    ALTER TABLE haycupo.usuario ADD COLUMN verificado boolean NOT NULL DEFAULT false;
    -- No cambiar grants de usuario: detener si los clientes podrían leer passwords
    -- o acreditar su propio correo mediante permisos directos/heredados.
    FOR principal IN SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated', 'authenticator') LOOP
        IF has_column_privilege(principal.rolname, 'haycupo.usuario', 'contrasena', 'SELECT')
           OR has_column_privilege(principal.rolname, 'haycupo.usuario', 'verificado', 'UPDATE') THEN
            RAISE EXCEPTION 'Revisar permisos sensibles de usuario para el rol cliente % antes de migrar.', principal.rolname;
        END IF;
    END LOOP;
    IF EXISTS (SELECT 1 FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a
               WHERE c.oid = usuario_oid AND a.grantee = 0 AND a.privilege_type IN ('SELECT','UPDATE')) THEN
        RAISE EXCEPTION 'Revisar SELECT/UPDATE público de usuario antes de migrar.';
    END IF;
    CREATE UNIQUE INDEX usuario_correo_normalizado_auth_uq
        ON haycupo.usuario (lower(btrim(correo)))
        WHERE correo IS NOT NULL AND btrim(correo) <> '';

    EXECUTE format($codes$
        CREATE TABLE haycupo.codigo_verificacion (
            id bigint GENERATED ALWAYS AS IDENTITY,
            id_usuario %s NOT NULL,
            codigo_hash text NOT NULL,
            intentos integer NOT NULL DEFAULT 0,
            usado boolean NOT NULL DEFAULT false,
            creado_en timestamptz NOT NULL DEFAULT CURRENT_TIMESTAMP,
            expira_en timestamptz NOT NULL,
            enviado_en timestamptz,
            CONSTRAINT codigo_verificacion_pkey PRIMARY KEY (id),
            CONSTRAINT codigo_verificacion_usuario_fkey FOREIGN KEY (id_usuario)
                REFERENCES haycupo.usuario(id_usuario) ON UPDATE NO ACTION ON DELETE CASCADE,
            CONSTRAINT codigo_verificacion_hash_check
                CHECK (char_length(codigo_hash) = 64 AND codigo_hash ~ '^[0-9a-f]{64}$'),
            CONSTRAINT codigo_verificacion_intentos_check CHECK (intentos >= 0),
            CONSTRAINT codigo_verificacion_expiracion_check CHECK (expira_en > creado_en),
            CONSTRAINT codigo_verificacion_envio_check CHECK (enviado_en IS NULL OR enviado_en >= creado_en)
        )
    $codes$, tipo_id);
    EXECUTE format($sessions$
        CREATE TABLE haycupo.sesion_jwt (
            jti uuid NOT NULL,
            id_usuario %s NOT NULL,
            expira_en timestamptz NOT NULL,
            revocado boolean NOT NULL DEFAULT false,
            CONSTRAINT sesion_jwt_pkey PRIMARY KEY (jti),
            CONSTRAINT sesion_jwt_usuario_fkey FOREIGN KEY (id_usuario)
                REFERENCES haycupo.usuario(id_usuario) ON UPDATE NO ACTION ON DELETE CASCADE
        )
    $sessions$, tipo_id);

    CREATE INDEX codigo_verificacion_usuario_estado_fecha_idx
        ON haycupo.codigo_verificacion (id_usuario, usado, creado_en DESC, id DESC);
    CREATE INDEX codigo_verificacion_historial_idx
        ON haycupo.codigo_verificacion (id_usuario, creado_en DESC);
    -- Pendiente significa usado=false, incluso sin envío confirmado o expirado.
    -- El backend invalida los anteriores bajo lock de usuario antes del INSERT.
    CREATE UNIQUE INDEX codigo_verificacion_pendiente_uq
        ON haycupo.codigo_verificacion (id_usuario) WHERE usado = false;
    CREATE INDEX sesion_jwt_usuario_idx ON haycupo.sesion_jwt (id_usuario);
    CREATE INDEX sesion_jwt_expiracion_idx ON haycupo.sesion_jwt (expira_en);

    -- Limpiar privilegios heredados de DEFAULT PRIVILEGES SOLO en tablas nuevas.
    -- RLS se habilita antes del commit; no se modifican políticas existentes.
    FOREACH object_name IN ARRAY ARRAY['codigo_verificacion', 'sesion_jwt'] LOOP
        EXECUTE format('ALTER TABLE haycupo.%I ENABLE ROW LEVEL SECURITY', object_name);
        EXECUTE format('REVOKE ALL ON TABLE haycupo.%I FROM PUBLIC', object_name);
        FOR principal IN
            SELECT DISTINCT r.rolname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
            CROSS JOIN LATERAL aclexplode(c.relacl) a JOIN pg_roles r ON r.oid = a.grantee
            WHERE n.nspname = 'haycupo' AND c.relname = object_name AND r.oid <> c.relowner
        LOOP
            EXECUTE format('REVOKE ALL ON TABLE haycupo.%I FROM %I', object_name, principal.rolname);
        END LOOP;
        EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE haycupo.%I TO %I', object_name, app_role);
        EXECUTE format('CREATE POLICY jwt_backend_only ON haycupo.%I FOR ALL TO %I USING (true) WITH CHECK (true)', object_name, app_role);
    END LOOP;
    seq_name := pg_get_serial_sequence('haycupo.codigo_verificacion', 'id');
    EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM PUBLIC', seq_name);
    FOR principal IN
        SELECT DISTINCT r.rolname FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a
        JOIN pg_roles r ON r.oid = a.grantee
        WHERE c.oid = seq_name::regclass AND r.oid <> c.relowner
    LOOP
        EXECUTE format('REVOKE ALL ON SEQUENCE %s FROM %I', seq_name, principal.rolname);
    END LOOP;
    EXECUTE format('GRANT USAGE ON SEQUENCE %s TO %I', seq_name, app_role);
END;
$migration$;
COMMIT;
