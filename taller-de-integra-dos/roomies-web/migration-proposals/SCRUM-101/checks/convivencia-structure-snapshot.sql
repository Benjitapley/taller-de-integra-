\set ON_ERROR_STOP on
BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;
\o /dev/null
\ir target.sql
\ir convivencia-target.sql
DO $check$
BEGIN
    IF to_regnamespace('convivencia_mensajeria') IS NULL THEN
        RAISE EXCEPTION 'SCRUM-101: falta el esquema de Convivencia';
    END IF;
END;
$check$;
SET LOCAL quote_all_identifiers = off;
SET LOCAL standard_conforming_strings = on;
\o

-- Stable within the same cluster. Exclude only ACL/RLS and physical bookkeeping
-- from structural records. Do not sample sequence counters or business rows.
WITH namespace AS (
    SELECT * FROM pg_namespace WHERE nspname = 'convivencia_mensajeria'
), relations AS (
    SELECT c.* FROM pg_class c JOIN namespace n ON c.relnamespace = n.oid
)
SELECT jsonb_build_object(
    'format', 'scrum101-convivencia-v1',
    'identity', jsonb_build_object('database',current_database(),
        'version',current_setting('server_version_num'),
        'system_identifier',(SELECT system_identifier::text FROM pg_control_system())),
    'schema', (SELECT to_jsonb(n) - 'nspacl' FROM namespace n),
    'relations', (SELECT COALESCE(jsonb_agg(to_jsonb(c) - ARRAY[
        'relacl','relrowsecurity','relforcerowsecurity','relfilenode','relpages','reltuples',
        'relallvisible','relallfrozen','relfrozenxid','relminmxid'
    ] ORDER BY c.oid), '[]'::jsonb) FROM relations c),
    'columns', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'catalog',to_jsonb(a) - 'attacl',
        'type',format_type(a.atttypid,a.atttypmod),
        'default',pg_get_expr(d.adbin,d.adrelid,false),
        'identity_sequence',CASE WHEN a.attidentity <> ''
            THEN pg_get_serial_sequence(format('%I.%I','convivencia_mensajeria',c.relname),a.attname)
            ELSE NULL END
    ) ORDER BY a.attrelid,a.attnum), '[]'::jsonb)
    FROM pg_attribute a JOIN relations c ON c.oid = a.attrelid
    LEFT JOIN pg_attrdef d ON d.adrelid=a.attrelid AND d.adnum=a.attnum
    WHERE c.relkind IN ('r','p','v','m','f') AND a.attnum > 0),
    'constraints', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'catalog',to_jsonb(k),'definition',pg_get_constraintdef(k.oid,false)
    ) ORDER BY k.oid), '[]'::jsonb)
    FROM pg_constraint k JOIN namespace n ON k.connamespace = n.oid),
    'indexes', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'catalog',to_jsonb(i),'definition',pg_get_indexdef(i.indexrelid)
    ) ORDER BY i.indexrelid), '[]'::jsonb) FROM pg_index i JOIN relations c ON c.oid=i.indexrelid),
    'sequences', (SELECT COALESCE(jsonb_agg(to_jsonb(s) ORDER BY s.seqrelid),'[]'::jsonb)
    FROM pg_sequence s JOIN relations c ON c.oid=s.seqrelid),
    'functions', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'catalog',to_jsonb(p) - 'proacl','definition',pg_get_functiondef(p.oid)
    ) ORDER BY p.oid), '[]'::jsonb)
    FROM pg_proc p JOIN namespace n ON p.pronamespace=n.oid),
    'triggers', (SELECT COALESCE(jsonb_agg(jsonb_build_object(
        'catalog',to_jsonb(t),'definition',pg_get_triggerdef(t.oid,false)
    ) ORDER BY t.oid), '[]'::jsonb) FROM pg_trigger t JOIN relations c ON c.oid=t.tgrelid)
);
ROLLBACK;
