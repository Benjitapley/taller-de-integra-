-- V2. SOLO LECTURA. Ejecutar únicamente tras una migración autorizada.
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL statement_timeout = '30s';

SELECT table_name, column_name, data_type, udt_schema, udt_name, is_nullable,
       column_default, is_identity, identity_generation
FROM information_schema.columns WHERE table_schema = 'haycupo'
  AND ((table_name = 'usuario' AND column_name IN ('id_usuario','verificado'))
       OR table_name IN ('codigo_verificacion','sesion_jwt'))
ORDER BY table_name, ordinal_position;
-- Se espera cero filas: nombres/tipos/nulabilidad faltantes o incompatibles.
WITH required(tabla,columna,tipo,no_nulo) AS (VALUES
    ('usuario','verificado','boolean'::regtype,true),
    ('codigo_verificacion','id','bigint'::regtype,true),
    ('codigo_verificacion','codigo_hash','text'::regtype,true),
    ('codigo_verificacion','intentos','integer'::regtype,true),
    ('codigo_verificacion','usado','boolean'::regtype,true),
    ('codigo_verificacion','creado_en','timestamptz'::regtype,true),
    ('codigo_verificacion','expira_en','timestamptz'::regtype,true),
    ('codigo_verificacion','enviado_en','timestamptz'::regtype,false),
    ('sesion_jwt','jti','uuid'::regtype,true),
    ('sesion_jwt','expira_en','timestamptz'::regtype,true),
    ('sesion_jwt','revocado','boolean'::regtype,true)
)
SELECT r.* FROM required r LEFT JOIN pg_attribute a
    ON a.attrelid = to_regclass(format('haycupo.%I',r.tabla)) AND a.attname = r.columna AND NOT a.attisdropped
WHERE a.attnum IS NULL OR a.atttypid <> r.tipo OR a.attnotnull <> r.no_nulo;
SELECT child.relname AS tabla, a.atttypid::regtype AS tipo_fk,
       a.atttypid = parent.atttypid AND a.attnotnull AS tipo_y_nulabilidad_correctos
FROM pg_class child JOIN pg_namespace n ON n.oid = child.relnamespace
JOIN pg_attribute a ON a.attrelid = child.oid AND a.attname = 'id_usuario' AND NOT a.attisdropped
JOIN pg_attribute parent ON parent.attrelid = 'haycupo.usuario'::regclass AND parent.attname = 'id_usuario' AND NOT parent.attisdropped
WHERE n.nspname = 'haycupo' AND child.relname IN ('codigo_verificacion','sesion_jwt');

SELECT con.conrelid::regclass AS tabla, con.conname, con.convalidated,
       pg_get_constraintdef(con.oid,true) AS definicion
FROM pg_constraint con WHERE con.conrelid IN
    ('haycupo.usuario'::regclass,'haycupo.codigo_verificacion'::regclass,'haycupo.sesion_jwt'::regclass)
    OR con.confrelid = 'haycupo.usuario'::regclass
ORDER BY con.conrelid::regclass::text, con.conname;
SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'haycupo' ORDER BY tablename,indexname;
SELECT c.relname AS indice, i.indisvalid, i.indisready
FROM pg_index i JOIN pg_class c ON c.oid = i.indexrelid
WHERE i.indrelid IN ('haycupo.usuario'::regclass,'haycupo.codigo_verificacion'::regclass,'haycupo.sesion_jwt'::regclass);

-- Comparar recuentos y definiciones existentes con preflight, sin tráfico.
SELECT (SELECT count(*) FROM haycupo.usuario) AS usuarios,
       (SELECT count(*) FROM haycupo.publicacion) AS publicaciones,
       (SELECT count(*) FROM haycupo.imagen_publicacion) AS imagenes,
       (SELECT count(*) FROM haycupo.conexion) AS conexiones;
SELECT count(*) AS usuarios,
       count(*) FILTER (WHERE verificado = false) AS no_verificados,
       count(*) FILTER (WHERE verificado = true) AS verificados,
       count(*) FILTER (WHERE verificado IS NULL) AS estados_nulos
FROM haycupo.usuario;
-- Inmediatamente después de migrar: 0 códigos, 0 sesiones, todos no verificados.
SELECT (SELECT count(*) FROM haycupo.codigo_verificacion) AS codigos,
       (SELECT count(*) FROM haycupo.sesion_jwt) AS sesiones;
-- No mostrar huellas HMAC ni identificadores de sesiones.
SELECT count(*) FILTER (WHERE u.id_usuario IS NULL) AS huerfanos,
       count(*) FILTER (WHERE char_length(c.codigo_hash) <> 64 OR c.codigo_hash !~ '^[0-9a-f]{64}$') AS hash_invalido,
       count(*) FILTER (WHERE c.intentos < 0) AS intentos_invalidos,
       count(*) FILTER (WHERE c.expira_en <= c.creado_en) AS expiraciones_invalidas,
       count(*) FILTER (WHERE c.enviado_en < c.creado_en) AS envios_invalidos
FROM haycupo.codigo_verificacion c LEFT JOIN haycupo.usuario u ON u.id_usuario = c.id_usuario;
SELECT count(*) AS usuarios_con_mas_de_un_codigo_pendiente FROM (
    SELECT id_usuario FROM haycupo.codigo_verificacion WHERE usado = false
    GROUP BY id_usuario HAVING count(*) > 1
) duplicados;
SELECT count(*) FILTER (WHERE u.id_usuario IS NULL) AS sesiones_huerfanas,
       count(*) FILTER (WHERE s.revocado IS NULL) AS revocacion_nula
FROM haycupo.sesion_jwt s LEFT JOIN haycupo.usuario u ON u.id_usuario = s.id_usuario;

SELECT c.relname, pg_get_userbyid(c.relowner) AS propietario, c.relrowsecurity,c.relforcerowsecurity
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'haycupo' AND c.relname IN ('codigo_verificacion','sesion_jwt');
SELECT tablename,policyname,roles,cmd,qual,with_check FROM pg_policies
WHERE schemaname = 'haycupo' AND tablename IN ('codigo_verificacion','sesion_jwt');
SELECT grantee,table_name,privilege_type,is_grantable FROM information_schema.table_privileges
WHERE table_schema = 'haycupo' AND table_name IN ('codigo_verificacion','sesion_jwt');
-- Revisar también membresías heredadas. No confundir el inspector con FastAPI.
WITH app AS (SELECT oid,rolname,rolsuper,rolbypassrls FROM pg_roles
             WHERE rolname = nullif(current_setting('haycupo.jwt_backend_role',true),''))
SELECT app.rolname,app.rolsuper,app.rolbypassrls,c.relname,
       has_table_privilege(app.oid,c.oid,'SELECT') AS lectura,
       has_table_privilege(app.oid,c.oid,'INSERT') AS alta,
       has_table_privilege(app.oid,c.oid,'UPDATE') AS edicion,
       has_table_privilege(app.oid,c.oid,'DELETE') AS borrado
FROM app CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'haycupo' AND c.relname IN ('codigo_verificacion','sesion_jwt');
WITH app AS (SELECT oid FROM pg_roles WHERE rolname = nullif(current_setting('haycupo.jwt_backend_role',true),''))
SELECT has_sequence_privilege(app.oid, pg_get_serial_sequence('haycupo.codigo_verificacion','id'), 'USAGE') AS uso_identidad
FROM app;
SELECT r.rolname,c.relname,
       has_table_privilege(r.oid,c.oid,'SELECT') AS lectura_auditar,
       has_table_privilege(r.oid,c.oid,'INSERT') AS alta_auditar,
       has_table_privilege(r.oid,c.oid,'UPDATE') AS edicion_auditar
FROM pg_roles r CROSS JOIN pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE r.rolname IN ('anon','authenticated','authenticator') AND n.nspname = 'haycupo'
  AND c.relname IN ('codigo_verificacion','sesion_jwt');
COMMIT;
