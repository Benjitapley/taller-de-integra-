"""Build a transactional restore of an explicitly exported business snapshot.

Never connects to the source or changes existing schemas. Passwords and the
private snapshot belong outside Git. Provider Auth/Storage remain in Supabase.
"""
import hashlib
import json
import re

SCHEMAS = {'haycupo', 'auth_users', 'listado_applications', 'convivencia_mensajeria'}
ROLES = {'sql_auth_users', 'sql_listado_applications', 'sql_convivencia_mensajeria'}


def ident(value):
    return '"' + value.replace('"', '""') + '"'


def literal(value):
    return "'" + value.replace("'", "''") + "'"


def qualified(schema, name):
    return ident(schema) + '.' + ident(name)


def build(snapshot, database):
    if database != 'roomies-db-test2' and not re.fullmatch(r'roomies_e05_restore_[a-z0-9_]+', database):
        raise ValueError('Explicit Kubero TEST or isolated restore database required')
    tables = snapshot['catalog']['tables']
    if {t['schema'] for t in tables} - SCHEMAS or snapshot['catalog'].get('views'):
        raise ValueError('Unsupported source schema/view: review before restoring')
    data = {t['name']: t for t in snapshot['data']}
    if set(data) != {t['schema']+'.'+t['name'] for t in tables}:
        raise ValueError('Snapshot table allowlist does not match catalog')
    statements = ['BEGIN;', "SET LOCAL timezone='UTC';", "SET LOCAL lock_timeout='5s';",
        "SELECT pg_advisory_xact_lock(hashtextextended('roomies:e05:migration',0));",
        "DO $$ BEGIN IF current_database()<>"+literal(database)+" THEN RAISE EXCEPTION 'Unexpected database'; END IF; "
        "IF EXISTS(SELECT 1 FROM pg_namespace WHERE nspname IN ('haycupo','auth_users','listado_applications','convivencia_mensajeria')) "
        "THEN RAISE EXCEPTION 'Existing business schemas require reconciliation'; END IF; END $$;"]
    for schema in sorted(SCHEMAS):
        statements += ['CREATE SCHEMA '+ident(schema)+';', 'REVOKE ALL ON SCHEMA '+ident(schema)+' FROM PUBLIC;']
    for enum in snapshot['metadata']['enums'] or []:
        if enum['schema'] != 'public' or enum['name'] != 'estadoconexion':
            raise ValueError('Unexpected enum')
        statements.append('CREATE TYPE '+qualified(enum['schema'],enum['name'])+' AS ENUM ('+','.join(map(literal,enum['labels']))+');')
    for seq in snapshot['metadata']['sequences']:
        if seq['schemaname'] == 'haycupo':
            statements.append('CREATE SEQUENCE '+qualified(seq['schemaname'],seq['sequencename'])+' AS integer;')
    for table in tables:
        columns=[]
        for c in table['columns']:
            if c['generated']:
                raise ValueError('Generated expression needs explicit review')
            definition=ident(c['name'])+' '+c['type']
            if c['identity']:
                definition+=' GENERATED '+('ALWAYS' if c['identity']=='a' else 'BY DEFAULT')+' AS IDENTITY'
            elif c['default'] is not None:
                definition+=' DEFAULT '+c['default']
            if c['notnull']:
                definition+=' NOT NULL'
            columns.append(definition)
        target=qualified(table['schema'],table['name'])
        statements.append('CREATE TABLE '+target+' ('+','.join(columns)+');')
        for c in table['columns']:
            if c['default'] and c['default'].startswith("nextval('"):
                seq=c['default'].split("'")[1]
                if not seq.startswith('haycupo.'):
                    raise ValueError('Unexpected serial sequence')
                statements.append('ALTER SEQUENCE '+seq+' OWNED BY '+target+'.'+ident(c['name'])+';')
        rows=data[table['schema']+'.'+table['name']]['rows']
        if len(rows)!=data[table['schema']+'.'+table['name']]['count']:
            raise ValueError('Truncated source snapshot')
        if rows:
            statements.append('INSERT INTO '+target+' OVERRIDING SYSTEM VALUE SELECT * FROM jsonb_populate_recordset(NULL::'+target+','+literal(json.dumps(rows,ensure_ascii=False,separators=(',',':')))+'::jsonb);')
        # Compare multisets, including duplicates, independently of DB collation.
        # The source and destination may sort jsonb::text differently.
        expected='SELECT value FROM jsonb_array_elements('+literal(json.dumps(rows,ensure_ascii=False,separators=(',',':')))+'::jsonb)'
        actual='SELECT to_jsonb(t) FROM '+target+' t'
        statements.append('DO $$ BEGIN IF EXISTS(('+actual+' EXCEPT ALL '+expected+') UNION ALL ('+expected+' EXCEPT ALL '+actual+')) THEN RAISE EXCEPTION '+literal('Restored rows differ: '+table['schema']+'.'+table['name'])+'; END IF; END $$;')
    for seq in snapshot['metadata']['sequences']:
        name=qualified(seq['schemaname'],seq['sequencename'])
        statements.append('SELECT setval('+literal(name)+','+str(seq['last_value'] or seq['start_value'])+','+('true' if seq['last_value'] is not None else 'false')+');')
    for function in snapshot['catalog']['functions'] or []:
        statements.append(function.rstrip(';\n')+';')
    constraints=snapshot['metadata']['constraints']
    for c in sorted(constraints,key=lambda c:c['type']=='f'):
        statements.append('ALTER TABLE '+qualified(c['schema'],c['table'])+' ADD CONSTRAINT '+ident(c['name'])+' '+c['definition']+';')
    constraint_indexes={(c['schema'],c['name']) for c in constraints if c['type'] in {'p','u','x'}}
    for index in snapshot['metadata']['indexes']:
        if (index['schema'],index['name']) not in constraint_indexes:
            statements.append(index['definition']+';')
    statements += [t+';' for t in snapshot['metadata']['triggers'] or []]
    for schema,role in [('auth_users','sql_auth_users'),('listado_applications','sql_listado_applications'),('convivencia_mensajeria','sql_convivencia_mensajeria')]:
        statements += ['GRANT USAGE ON SCHEMA '+ident(schema)+' TO '+ident(role)+';',
            'GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA '+ident(schema)+' TO '+ident(role)+';',
            'REVOKE ALL ON ALL FUNCTIONS IN SCHEMA '+ident(schema)+' FROM PUBLIC;']
    statements += ['GRANT USAGE ON SCHEMA haycupo TO sql_auth_users,sql_listado_applications;',
        'GRANT USAGE,SELECT ON ALL SEQUENCES IN SCHEMA haycupo TO sql_auth_users,sql_listado_applications;']
    table_grants=set()
    for g in snapshot['permissions']['grants']:
        if g['grantee'] not in ROLES or g['privilege_type'] not in {'SELECT','INSERT','UPDATE','DELETE'}:
            raise ValueError('Unexpected privilege')
        table_grants.add((g['table_schema'],g['table_name'],g['grantee'],g['privilege_type']))
        statements.append('GRANT '+g['privilege_type']+' ON '+qualified(g['table_schema'],g['table_name'])+' TO '+ident(g['grantee'])+';')
    for g in snapshot['permissions']['column_grants']:
        if (g['table_schema'],g['table_name'],g['grantee'],g['privilege_type']) not in table_grants:
            if g['grantee'] not in ROLES or g['privilege_type'] not in {'SELECT','INSERT','UPDATE'}:
                raise ValueError('Unexpected column privilege')
            statements.append('GRANT '+g['privilege_type']+'('+ident(g['column_name'])+') ON '+qualified(g['table_schema'],g['table_name'])+' TO '+ident(g['grantee'])+';')
    # New destination: service-only RLS, with column ACLs still restricting legacy secrets.
    for table in tables:
        target=qualified(table['schema'],table['name'])
        if table['schema']=='haycupo':
            role={'usuario':'sql_auth_users','publicacion':'sql_listado_applications','imagen_publicacion':'sql_listado_applications'}.get(table['name'])
            if not role:
                continue  # Historical Match data is preserved without changing its live app/role.
        else:
            role={'auth_users':'sql_auth_users','listado_applications':'sql_listado_applications','convivencia_mensajeria':'sql_convivencia_mensajeria'}[table['schema']]
        statements += ['ALTER TABLE '+target+' ENABLE ROW LEVEL SECURITY;',
            'CREATE POLICY runtime_role_access ON '+target+' TO '+ident(role)+' USING(true) WITH CHECK(true);']
    # Existing trigger and row-lock permissions are column-scoped in the source.
    statements += ['GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA convivencia_mensajeria TO sql_convivencia_mensajeria;',
        'CREATE SCHEMA roomies_deploy_meta;', 'REVOKE ALL ON SCHEMA roomies_deploy_meta FROM PUBLIC;',
        'CREATE TABLE roomies_deploy_meta.migration(path text PRIMARY KEY,sha256 text NOT NULL,applied_at timestamptz NOT NULL DEFAULT clock_timestamp());',
        "INSERT INTO roomies_deploy_meta.migration(path,sha256) VALUES('supabase-business-snapshot',"+literal(hashlib.sha256(json.dumps(snapshot,sort_keys=True).encode()).hexdigest())+');',
        'COMMIT;']
    return '\n'.join(statements)+'\n'
