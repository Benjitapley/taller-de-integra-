"""Análisis estático: no importa backend, no carga .env y no ejecuta SQL.
Ejecutar con .venv/Scripts/python.exe -I -B migration-proposals/SCRUM-72/tests/test_consistency.py
"""
import os
import ast
import base64
import json
import re
import socket
import unittest
from pathlib import Path

# No usar entorno del proyecto ni permitir conexiones durante estas pruebas.
keep = {k: v for k, v in os.environ.items() if k.upper() in {'SYSTEMROOT','WINDIR','TEMP','TMP'}}
os.environ.clear()
os.environ.update(keep)
def no_network(*args, **kwargs):
    raise AssertionError('Estas pruebas estáticas no permiten red')
socket.socket.connect = no_network
socket.socket.connect_ex = no_network
socket.socket.sendto = no_network
socket.create_connection = no_network

from pglast import parser, parse_plpgsql

ROOT = Path(__file__).resolve().parents[3]
PROPOSAL = Path(__file__).resolve().parents[1]
SQL = {name: (PROPOSAL / name).read_text(encoding='utf-8-sig') for name in
       ('01-preflight.sql','02-email-verification.sql','03-postflight.sql')}
MIGRATION = SQL['02-email-verification.sql']
USER_COLUMNS = set('id_usuario nombre presupuesto zona_interes ocupacion edad ciudad biografia foto_perfil breve_descripcion sobre_mi correo contrasena fecha_nacimiento verificado'.split())
SOURCES = [ROOT / path for path in ('backend/auth_service/main.py','backend/auth_service/security.py','backend/main/main.py')]


def walk(value):
    if isinstance(value, dict):
        yield value
        for child in value.values():
            yield from walk(child)
    elif isinstance(value, list):
        for child in value:
            yield from walk(child)


def parsed(sql):
    return json.loads(parser.parse_sql_json(sql))['stmts']


def ddl_tables(id_type='integer'):
    result = {}
    for tag in ('codes','sessions'):
        template = re.search(r'\$' + tag + r'\$(.*?)\$' + tag + r'\$', MIGRATION, re.S).group(1)
        statement = parsed(template.replace('%s',id_type))[0]['stmt']['CreateStmt']
        columns = {elt['ColumnDef']['colname']: elt['ColumnDef'] for elt in statement['tableElts'] if 'ColumnDef' in elt}
        result[statement['relation']['relname']] = (statement, columns)
    return result


def backend_queries():
    queries = []
    for source in SOURCES:
        tree = ast.parse(source.read_text(encoding='utf-8-sig'))
        for node in ast.walk(tree):
            if isinstance(node, ast.Call) and isinstance(node.func, ast.Attribute) and node.func.attr == 'execute':
                assert node.args and isinstance(node.args[0], ast.Constant) and isinstance(node.args[0].value, str), 'SQL dinámico de backend requiere revisión del test'
                queries.append(node.args[0].value)
    return queries


def check_query_columns(sql, tables):
    for raw in parsed(sql.replace('%s','NULL')):
        statement = raw['stmt']
        relations = {}
        for node in walk(statement):
            if 'RangeVar' in node or ('relname' in node and 'schemaname' in node):
                relation = node.get('RangeVar',node)
                if relation.get('schemaname') == 'haycupo':
                    name = relation['relname']
                    alias = relation.get('alias',{}).get('aliasname',name)
                    relations[alias] = name
        for node in walk(statement):
            if 'ColumnRef' not in node:
                continue
            fields = [part['String']['sval'] for part in node['ColumnRef']['fields'] if 'String' in part]
            if not fields:
                continue  # count(*)
            if len(fields) > 1:
                target = relations.get(fields[-2], fields[-2])
            elif len(set(relations.values())) == 1:
                target = next(iter(relations.values()))
            else:
                raise AssertionError(f'Columna no calificada con JOIN: {fields}')
            if target in tables:
                assert fields[-1] in tables[target], f'{target}.{fields[-1]} no existe en propuesta'
        for kind, field in [('InsertStmt','cols'),('UpdateStmt','targetList')]:
            if kind not in statement:
                continue
            stmt = statement[kind]
            table = stmt['relation']['relname']
            if table not in tables:
                continue
            for target in stmt.get(field,[]):
                name = target['ResTarget']['name']
                assert name in tables[table], f'{table}.{name} no existe en propuesta'


class MigrationConsistency(unittest.TestCase):
    def test_sql_and_plpgsql_syntax_without_execution(self):
        for name, sql in SQL.items():
            with self.subTest(script=name):
                self.assertTrue(parsed(sql))
        functions = parse_plpgsql(MIGRATION)
        self.assertTrue(functions)
        # PL/pgSQL contiene DDL/SQL estático que el parser exterior trata como texto.
        for node in walk(functions):
            expression = node.get('PLpgSQL_expr',{}).get('query','')
            if expression and expression.lstrip().upper().startswith(('SELECT ','CREATE ','ALTER ','LOCK ')):
                parsed(expression)
        for id_type in ('smallint','integer','bigint'):
            ddl_tables(id_type)

    def test_inspections_are_read_only(self):
        for name in ('01-preflight.sql','03-postflight.sql'):
            self.assertIn('READ ONLY',SQL[name])
            for raw in parsed(SQL[name]):
                self.assertIn(next(iter(raw['stmt'])), {'TransactionStmt','VariableSetStmt','SelectStmt'})

    def test_exact_new_column_names_and_types(self):
        expected = {
            'codigo_verificacion': {'id':'int8','id_usuario':'int4','codigo_hash':'text','intentos':'int4','usado':'bool','creado_en':'timestamptz','expira_en':'timestamptz','enviado_en':'timestamptz'},
            'sesion_jwt': {'jti':'uuid','id_usuario':'int4','expira_en':'timestamptz','revocado':'bool'},
        }
        for table, (_,columns) in ddl_tables().items():
            self.assertEqual(set(columns),set(expected[table]))
            for name,column in columns.items():
                self.assertEqual(column['typeName']['names'][-1]['String']['sval'],expected[table][name])
                constraints = {c['Constraint']['contype'] for c in column.get('constraints',[])}
                if name == 'enviado_en':
                    self.assertNotIn('CONSTR_NOTNULL',constraints)
                else:
                    self.assertTrue(constraints & {'CONSTR_NOTNULL','CONSTR_IDENTITY'})

    def test_id_type_is_derived_for_both_foreign_keys(self):
        for id_type, canonical in [('smallint','int2'),('integer','int4'),('bigint','int8')]:
            for table, (statement,columns) in ddl_tables(id_type).items():
                self.assertEqual(columns['id_usuario']['typeName']['names'][-1]['String']['sval'],canonical)
                fks = [part['Constraint'] for part in statement['tableElts'] if part.get('Constraint',{}).get('contype') == 'CONSTR_FOREIGN']
                self.assertEqual(len(fks),1)
                self.assertEqual(fks[0]['pktable']['relname'],'usuario')
                self.assertEqual(fks[0]['pktable']['schemaname'],'haycupo')
                self.assertEqual(fks[0]['pk_attrs'][0]['String']['sval'],'id_usuario')
        self.assertIn('CASE a.atttypid',MIGRATION)
        self.assertIn('NOT condeferrable',MIGRATION)
        self.assertIn('id_not_null IS DISTINCT FROM true',MIGRATION)

    def test_all_backend_sql_columns_match_migration(self):
        tables = {name:set(columns) for name,(_,columns) in ddl_tables().items()}
        tables['usuario'] = USER_COLUMNS
        queries = backend_queries()
        self.assertGreater(len(queries),20)
        for sql in queries:
            with self.subTest(query=sql[:80]):
                check_query_columns(sql,tables)

    def test_insert_omissions_have_defaults_identity_or_nullable(self):
        definitions = ddl_tables()
        for sql in backend_queries():
            for raw in parsed(sql.replace('%s','NULL')):
                insert = raw['stmt'].get('InsertStmt')
                if not insert or insert['relation']['relname'] not in definitions:
                    continue
                table = insert['relation']['relname']
                supplied = {c['ResTarget']['name'] for c in insert['cols']}
                for name,column in definitions[table][1].items():
                    if name not in supplied:
                        kinds = {c['Constraint']['contype'] for c in column.get('constraints',[])}
                        self.assertTrue('CONSTR_NOTNULL' not in kinds or kinds & {'CONSTR_DEFAULT','CONSTR_IDENTITY'},f'{table}.{name}')

    def test_detects_backend_column_drift(self):
        tables = {name:set(columns) for name,(_,columns) in ddl_tables().items()}
        with self.assertRaises(AssertionError):
            check_query_columns('SELECT codigo FROM haycupo.codigo_verificacion',tables)
        with self.assertRaises(AssertionError):
            check_query_columns('INSERT INTO haycupo.sesion_jwt (token) VALUES (NULL)',tables)
        broken = {name:set(columns) for name,columns in tables.items()}
        broken['codigo_verificacion'].remove('enviado_en')
        with self.assertRaises(AssertionError):
            for sql in backend_queries():
                check_query_columns(sql,broken)

    def test_no_existing_row_mutation_or_table_replacement(self):
        # Revisar también SQL estático interno: no UPDATE/DELETE/INSERT/DROP/TRUNCATE.
        for node in walk(parse_plpgsql(MIGRATION)):
            query = node.get('PLpgSQL_expr',{}).get('query','')
            if query and re.match(r'\s*(UPDATE|DELETE|INSERT|DROP|TRUNCATE)\b',query,re.I):
                self.fail('Migración contiene DML o eliminación: '+query[:80])
        for table in ('publicacion','imagen_publicacion','conexion'):
            self.assertNotRegex(MIGRATION,rf'(?i)(?:ALTER|DROP|CREATE)\s+TABLE\s+haycupo\.{table}\b')
        self.assertIn('ADD COLUMN verificado boolean NOT NULL DEFAULT false',MIGRATION)
        self.assertIn('BEGIN;',MIGRATION)
        self.assertTrue(MIGRATION.rstrip().endswith('COMMIT;'))

    def test_hash_format_matches_hmac_backend(self):
        tree = ast.parse((ROOT/'backend/auth_service/email_service.py').read_text(encoding='utf-8-sig'))
        self.assertTrue(any(isinstance(n,ast.Attribute) and n.attr=='sha256' for n in ast.walk(tree)))
        self.assertTrue(any(isinstance(n,ast.Attribute) and n.attr=='hexdigest' for n in ast.walk(tree)))
        self.assertIn('char_length(codigo_hash) = 64',MIGRATION)
        self.assertIn("'^[0-9a-f]{64}$'",MIGRATION)
        self.assertNotIn('codigo',ddl_tables()['codigo_verificacion'][1])

    def test_argon2_capacity_tracks_backend_configuration(self):
        tree = ast.parse((ROOT/'backend/auth_service/security.py').read_text(encoding='utf-8-sig'))
        call = next(n for n in ast.walk(tree) if isinstance(n,ast.Call) and isinstance(n.func,ast.Name) and n.func.id=='PasswordHasher')
        config = {kw.arg:ast.literal_eval(kw.value) for kw in call.keywords}
        b64len = lambda size: len(base64.b64encode(bytes(size)).rstrip(b'='))
        size = len(f"$argon2id$v=19$m={config['memory_cost']},t={config['time_cost']},p={config['parallelism']}$") + b64len(config['salt_len']) + 1 + b64len(config['hash_len'])
        capacity = int(re.search(r"\('contrasena',(\d+)\)",MIGRATION).group(1))
        self.assertGreaterEqual(capacity,size)

    def test_indices_and_privacy_are_explicit(self):
        self.assertIn('(id_usuario, usado, creado_en DESC, id DESC)',MIGRATION)
        self.assertIn('(id_usuario, creado_en DESC)',MIGRATION)
        self.assertRegex(MIGRATION,r'(?s)CREATE UNIQUE INDEX codigo_verificacion_pendiente_uq.*?WHERE usado = false;')
        self.assertIn('lower(btrim(correo))',MIGRATION)
        self.assertIn('CREATE INDEX sesion_jwt_expiracion_idx',MIGRATION)
        self.assertIn('ENABLE ROW LEVEL SECURITY',MIGRATION)
        self.assertIn('REVOKE ALL ON TABLE haycupo.%I FROM PUBLIC',MIGRATION)
        self.assertIn('TO %I USING (true) WITH CHECK (true)',MIGRATION)
        self.assertNotRegex(MIGRATION,r'(?i)GRANT\s+[^;]+\s+TO\s+PUBLIC')
        self.assertIn("current_setting('haycupo.jwt_backend_role', true)",MIGRATION)
        self.assertIn('NOT rolsuper AND NOT rolbypassrls',MIGRATION)


if __name__ == '__main__':
    unittest.main(verbosity=2)
