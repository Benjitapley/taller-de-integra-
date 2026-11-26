"""Offline checks for the SCRUM-101 phase entry points."""
import hashlib
import json
import re
import unittest
from pathlib import Path


ROOT = Path(__file__).resolve().parent
MANIFEST = json.loads((ROOT / "manifest.json").read_text(encoding="utf-8"))


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def includes(path):
    return re.findall(r"^\\ir (\S+)$", read(path), re.MULTILINE)


class PhaseContract(unittest.TestCase):
    def test_manifest_order_and_includes(self):
        preflight, provision = MANIFEST["steps"][:2]
        self.assertEqual(MANIFEST["manifest_version"], 1)
        self.assertEqual([preflight["id"], provision["id"]], ["000", "010"])
        self.assertEqual(preflight["requires"], [])
        self.assertEqual(provision["requires"], ["000"])
        for step in (preflight, provision):
            self.assertEqual(includes(step["entrypoint"]), step["checks"])
            for path in step["checks"]:
                self.assertTrue((ROOT / path).is_file())
                self.assertEqual(includes(path), [])
        self.assertEqual(includes(provision["verify"]),
                         [preflight["checks"][0], provision["checks"][-1]])

    def test_verifiers_are_read_only(self):
        for name in ("000-preflight.sql", "010-verify.sql", "022-auth-verify.sql"):
            body = read(name)
            self.assertTrue(body.startswith("\\set ON_ERROR_STOP on\nBEGIN TRANSACTION READ ONLY;\n"))
            self.assertTrue(body.endswith("ROLLBACK;\n"))
        for path in MANIFEST["steps"][1]["checks"]:
            self.assertNotRegex(read(path), r"(?im)^\s*(CREATE|ALTER|GRANT|REVOKE|INSERT|UPDATE|DELETE)\s")

    def test_target_guards_match_manifest(self):
        target = read("checks/target.sql")
        self.assertIn(str(MANIFEST["server_version_num"]), target)
        self.assertIn(MANIFEST["database"], target)
        self.assertIn(MANIFEST["database_comment"], target)
        self.assertIn("inet_server_addr() IS NOT NULL", target)
        self.assertIn("current_user <> session_user", target)
        self.assertIn("rolsuper AND rolcanlogin", target)

    def test_provision_is_atomic_and_checks_before_and_after_writes(self):
        body = read("010-provision.sql")
        self.assertTrue(body.startswith("\\set ON_ERROR_STOP on\nBEGIN;\n"))
        self.assertTrue(body.endswith("\\ir checks/provisioned.sql\nCOMMIT;\n"))
        checkpoints = ("pg_advisory_xact_lock", "checks/target.sql", "checks/pristine.sql",
                       "CREATE ROLE", "ALTER DEFAULT PRIVILEGES", "checks/provisioned.sql")
        positions = [body.index(token) for token in checkpoints]
        self.assertEqual(positions, sorted(positions))
        self.assertEqual(body.count("COMMIT;"), 1)

    def test_role_contract(self):
        owner = MANIFEST["roles"]["owner"]
        runtime = MANIFEST["roles"]["runtime"]
        roles = [owner, *runtime]
        self.assertEqual(len(set(roles)), 6)
        body = read("010-provision.sql")
        self.assertEqual(re.findall(r"^CREATE ROLE (\w+) ", body, re.MULTILINE), roles)
        attrs = "NOINHERIT NOSUPERUSER NOCREATEDB NOCREATEROLE NOREPLICATION NOBYPASSRLS"
        for role in roles:
            login = "NOLOGIN" if role == owner else "LOGIN"
            self.assertIn(f"CREATE ROLE {role} {login} {attrs};", body)
            for path in ("checks/pristine.sql", "checks/provisioned.sql"):
                self.assertIn(f"'{role}'", read(path))
        grants = re.findall(r"^GRANT ([A-Z, ]+) ON DATABASE .*? TO (.*?);",
                            body, re.MULTILINE | re.DOTALL)
        self.assertEqual(grants[0], ("CREATE, CONNECT", owner))
        self.assertEqual(grants[1][0], "CONNECT")
        self.assertEqual(grants[1][1].replace(",", " ").split(), runtime)
        self.assertEqual(len(grants), 2)

    def test_phase_has_no_destructive_sql_or_credentials(self):
        for path in ROOT.rglob("*.sql"):
            body = "\n".join(line for line in path.read_text(encoding="utf-8").splitlines()
                             if not line.lstrip().startswith("--"))
            with self.subTest(path=path.name):
                self.assertNotRegex(body, r"(?i)\b(?:DROP\s+\w+|TRUNCATE\s+\w+|PASSWORD)\b")
                self.assertNotRegex(body, r"(?i)\bALTER\s+ROLE\b|postgres(?:ql)?://")
            self.assertNotRegex(body, r"(?im)^\s*CREATE\s+DATABASE\b")
            if path.relative_to(ROOT).as_posix() in {
                "000-preflight.sql", "010-provision.sql", "010-verify.sql",
                "checks/target.sql", "checks/pristine.sql", "checks/provisioned.sql",
            }:
                self.assertNotRegex(body, r"(?im)^\s*CREATE\s+(TABLE|SCHEMA)\b")

    def test_auth_dependencies_and_transaction_order(self):
        steps = [step for step in MANIFEST["steps"] if step["id"] in {"020", "021", "022"}]
        self.assertEqual([step["id"] for step in steps], ["020", "021", "022"])
        self.assertEqual([step["requires"] for step in steps], [["010"], ["020"], ["021"]])
        for step in steps:
            body = read(step["entrypoint"])
            self.assertEqual(includes(step["entrypoint"]), step["includes"])
            self.assertTrue(body.startswith("\\set ON_ERROR_STOP on\nBEGIN;\n"))
            self.assertTrue(body.endswith("COMMIT;\n"))
            self.assertLess(body.index("checks/target.sql"), body.index("SET LOCAL ROLE"))
            self.assertLess(body.index("checks/provisioned.sql"), body.index("SET LOCAL ROLE"))
            self.assertNotIn("checks/pristine.sql", body)
            for path in step["includes"]:
                self.assertTrue((ROOT / path).is_file())
        acl = read(steps[-1]["entrypoint"])
        self.assertLess(acl.index("RESET ROLE;"), acl.index("checks/auth-permissions.sql"))

    def test_auth_upstream_copy_and_pinned_digest(self):
        step = MANIFEST["steps"][2]
        upstream = step["upstream"]
        original = (ROOT / upstream["source"]).read_text(encoding="utf-8")
        mirror = read(upstream["mirror"])
        self.assertEqual(mirror, original)
        self.assertEqual(hashlib.sha256(mirror.encode()).hexdigest(), upstream["sha256_lf"])
        entrypoint = read(step["entrypoint"])
        self.assertIn(upstream["sha256_lf"], entrypoint)
        self.assertLess(entrypoint.index("pg_read_binary_file"), entrypoint.index("SET LOCAL ROLE"))
        self.assertNotRegex(mirror, r"(?im)^\s*(BEGIN|COMMIT|ROLLBACK);")

    def test_auth_policy_actions_match_grants_and_verifier(self):
        acl = read("022-auth-acl.sql")
        policies = re.findall(r"CREATE POLICY runtime_\w+ ON auth_users\.(\w+) FOR (\w+)", acl)
        grants = re.findall(r"GRANT (SELECT|INSERT|UPDATE|DELETE)(?: \(([^)]+)\))? ON auth_users\.(\w+) TO sql_auth_users;", acl)
        self.assertEqual(policies, [(table, action) for action, _, table in grants])
        verifier = read("checks/auth-permissions.sql")
        expected = [(table, action, columns.replace(" ", "")) for action, columns, table in grants]
        self.assertEqual(expected, re.findall(r"\('(\w+)', '(SELECT|INSERT|UPDATE|DELETE)', '([^']*)'\)", verifier))
        self.assertEqual(len(policies), 13)
        self.assertIn("<> expected_policies THEN", verifier)
        self.assertNotRegex(acl, r"\b(?:anon|authenticated|PUBLIC)\b")

    def test_auth_behavior_is_opt_in_and_rolls_back(self):
        step = next(step for step in MANIFEST["steps"] if step["id"] == "022")
        body = read(step["behavior"])
        self.assertTrue(body.startswith("\\set ON_ERROR_STOP on\nBEGIN;\n"))
        self.assertTrue(body.endswith("ROLLBACK;\n"))
        self.assertNotIn("COMMIT;", body)
        for path in includes(step["behavior"]):
            self.assertTrue((ROOT / "tests" / path).is_file())


class ListadoContract(unittest.TestCase):
    steps = [step for step in MANIFEST["steps"] if step["id"] in {"030", "031", "032", "033", "034"}]

    def test_listado_order_scope_and_atomicity(self):
        self.assertEqual([step["id"] for step in self.steps], ["030", "031", "032", "033", "034"])
        self.assertEqual([step["requires"] for step in self.steps], [["022"], ["030"], ["031"], ["032"], ["033"]])
        for step in self.steps:
            name = step["entrypoint"]
            body = read(name)
            self.assertEqual(includes(name), step["includes"])
            self.assertTrue(body.startswith("\\set ON_ERROR_STOP on\nBEGIN;\n"))
            self.assertTrue(body.endswith("COMMIT;\n"))
            self.assertEqual(re.findall(r"(?m)^(BEGIN|COMMIT|ROLLBACK);$", body), ["BEGIN", "COMMIT"])
            scope = body.split("SET LOCAL ROLE scrum101_owner;", 1)
            self.assertEqual(len(scope), 2)
            self.assertIn("checks/target.sql", scope[0])
            self.assertIn("checks/provisioned.sql", scope[0])
            self.assertIn("checks/auth-permissions.sql", scope[0])
            self.assertIn("checks/listado-base.sql", scope[0])
            self.assertNotRegex(scope[1], r"\b(auth_users|haycupo)\.")
            for path in step["includes"]:
                self.assertTrue((ROOT / path).is_file())
        acl = read(self.steps[-1]["entrypoint"])
        self.assertLess(acl.index("RESET ROLE;"), acl.index("checks/listado-permissions.sql"))

    def test_listado_source_fingerprints_and_cut_contents(self):
        for step in self.steps:
            source = step["source"]
            body = read(source["path"])
            self.assertEqual(hashlib.sha256(body.encode()).hexdigest(), source["sha256_lf"])
            self.assertEqual(source["revision"], "b992c5e")
        seed = read(self.steps[3]["source"]["path"])
        self.assertIn(seed[seed.index("INSERT INTO"):seed.rindex("COMMIT;")], read("033-listado-cut.sql"))
        counts = []
        for section in seed.split(" VALUES\n")[1:]:
            rows = []
            for keys, name in re.findall(r"(?m)^\((\d+(?:,\d+)?),'((?:[^']|'')*)'\),?$", section):
                rows.append((int(keys.split(",")[0]), keys.replace(",", chr(31)) + chr(31) + name.replace("''", "'")))
            counts.append(len(rows))
            digest = hashlib.sha256("\n".join(payload for _, payload in sorted(rows)).encode()).hexdigest()
            self.assertIn(digest, read("checks/listado-cut.sql"))
        self.assertEqual(counts, [16, 346])

    def test_listado_grants_match_verifier_and_policies(self):
        acl = read("034-listado-admissions-acl.sql")
        grants = re.findall(r"GRANT (SELECT|INSERT|UPDATE|DELETE)(?: \(([^)]+)\))? ON listado_applications\.(\w+) TO sql_listado_applications;", acl)
        policies = re.findall(r"CREATE POLICY runtime_\w+ ON listado_applications\.(\w+) FOR (\w+)", acl)
        self.assertEqual(policies, [(table, action) for action, _, table in grants])
        expected = []
        verifier = read("checks/listado-permissions.sql")
        for table, selected, inserted, updated, deleted in re.findall(r"\('(\w+)', '([^']*)', '([^']*)', '([^']*)', (true|false)\)", verifier):
            for action, columns in zip(("SELECT", "INSERT", "UPDATE"), (selected, inserted, updated)):
                if columns:
                    expected.append((action, columns, table))
            if deleted == "true":
                expected.append(("DELETE", "", table))
        self.assertEqual([(a, c.replace(" ", ""), t) for a, c, t in grants], expected)
        self.assertNotRegex(acl, r"(?im)^GRANT\s+(?:ALL|CREATE)\b|WITH GRANT OPTION")

    def test_listado_verifier_and_behavior_boundaries(self):
        verify = read(self.steps[-1]["verify"])
        behavior_path = self.steps[-1]["behavior"]
        behavior = read(behavior_path)
        self.assertTrue(verify.startswith("\\set ON_ERROR_STOP on\nBEGIN TRANSACTION READ ONLY;"))
        self.assertTrue(behavior.startswith("\\set ON_ERROR_STOP on\nBEGIN;"))
        for body in (verify, behavior):
            self.assertTrue(body.endswith("ROLLBACK;\n"))
            self.assertNotIn("COMMIT;", body)
            self.assertNotRegex(body, r"(?im)^\s*(CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE)\s")
        for include in includes(behavior_path):
            self.assertTrue((ROOT / "tests" / include).is_file())
        for state in ("42501", "23505", "23503", "23514"):
            self.assertIn(f"WHEN SQLSTATE '{state}'", behavior)
        self.assertIn("SET LOCAL ROLE sql_listado_applications;", behavior)


class MatchContract(unittest.TestCase):
    steps = [step for step in MANIFEST["steps"] if step["id"] in {"040", "041"}]

    def test_match_order_sources_and_transactions(self):
        self.assertEqual([step["id"] for step in self.steps], ["040", "041"])
        self.assertEqual([step["requires"] for step in self.steps], [["034"], ["040"]])
        for step in self.steps:
            self.assertEqual(step["layout"], "private-v1")
            for provenance in [step["source"], *([step["contract"]] if "contract" in step else [])]:
                self.assertEqual(provenance["revision"], "9dc8f10")
                self.assertEqual(hashlib.sha256(read(provenance["path"]).encode()).hexdigest(),
                                 provenance["sha256_lf"])
            name = step["entrypoint"]
            body = read(name)
            self.assertEqual(includes(name), step["includes"])
            self.assertTrue(body.startswith("\\set ON_ERROR_STOP on\nBEGIN;\n"))
            self.assertTrue(body.endswith("COMMIT;\n"))
            self.assertEqual(re.findall(r"(?m)^(BEGIN|COMMIT|ROLLBACK);$", body), ["BEGIN", "COMMIT"])
            preflight, changes = body.split("SET LOCAL ROLE scrum101_owner;", 1)
            for required in ("target", "provisioned", "auth-permissions", "listado-permissions", "match-base"):
                self.assertIn(f"checks/{required}.sql", preflight)
            for path in step["includes"]:
                self.assertTrue((ROOT / path).is_file())
                self.assertEqual(includes(path), [])
            self.assertNotRegex(changes, r"\b(?:auth_users|listado_applications|haycupo)\.|\bREFERENCES\s")

    def test_match_shape_privileges_and_trigger(self):
        base = read("040-match-base.sql")
        history = read("041-match-history-acl.sql")
        self.assertNotRegex(base, r"(?im)^GRANT ")
        self.assertIn("GENERATED ALWAYS AS IDENTITY PRIMARY KEY", base)
        self.assertIn('LEAST("id_solicitante_FK","id_receptor_FK"), GREATEST("id_solicitante_FK","id_receptor_FK")', base)
        self.assertIn("WHERE estado IN ('Pendiente','Aceptada')", base)
        self.assertIn("PRIMARY KEY (usuario_menor, usuario_mayor)", history)
        self.assertNotIn("primera_aceptacion", history)
        self.assertIn("SECURITY DEFINER SET search_path = pg_catalog, pg_temp", history)
        self.assertIn("FROM PUBLIC, sql_match_conexion;", history)
        self.assertEqual(history.count("ON CONFLICT DO NOTHING"), 2)
        self.assertLess(history.index("LOCK TABLE"), history.index("CREATE TRIGGER"))
        self.assertLess(history.index("CREATE TRIGGER"), history.index("FROM match_conexion.conexion WHERE"))
        self.assertLess(history.index("RESET ROLE;"), history.index("checks/match-permissions.sql"))
        self.assertEqual(len(re.findall(r"(?m)^CREATE POLICY ", history)), 5)
        self.assertNotRegex(history, r"(?im)^GRANT\s+(?:ALL|CREATE|EXECUTE)\b|WITH GRANT OPTION")

    def test_match_verifier_and_behavior_boundaries(self):
        step = self.steps[-1]
        verify, behavior = read(step["verify"]), read(step["behavior"])
        self.assertTrue(verify.startswith("\\set ON_ERROR_STOP on\nBEGIN TRANSACTION READ ONLY;\n"))
        self.assertTrue(behavior.startswith("\\set ON_ERROR_STOP on\nBEGIN;\n"))
        for body in (verify, behavior):
            self.assertTrue(body.endswith("ROLLBACK;\n"))
            self.assertNotIn("COMMIT;", body)
            self.assertNotRegex(body, r"(?im)^\s*(CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE)\s")
        self.assertEqual(includes(step["behavior"]), [f"../{path}" for path in includes(step["verify"])])
        for path in includes(step["verify"]):
            self.assertTrue((ROOT / path).is_file())
        for state in ("42501", "23505", "23514"):
            self.assertIn(f"WHEN SQLSTATE '{state}'", behavior)
        self.assertIn("SET LOCAL ROLE sql_match_conexion;", behavior)


class ConvivenciaContract(unittest.TestCase):
    steps = [step for step in MANIFEST["steps"] if step["id"] in {"050", "051", "052"}]

    def test_order_provenance_and_atomicity(self):
        self.assertEqual([step["id"] for step in self.steps], ["050", "051", "052"])
        self.assertEqual([step["requires"] for step in self.steps], [["041"], ["050"], ["051"]])
        for stage, step in enumerate(self.steps):
            with self.subTest(step=step["id"]):
                body = read(step["entrypoint"])
                self.assertEqual(step["status"], "prepared-not-executed")
                self.assertEqual(step["layout"], "private-v1")
                self.assertEqual(step["transaction"], "atomic")
                self.assertEqual(includes(step["entrypoint"]), step["includes"])
                self.assertTrue(all((ROOT / path).is_file() for path in step["includes"]))
                self.assertTrue(body.startswith("\\set ON_ERROR_STOP on\nBEGIN;\n"))
                self.assertEqual(re.findall(r"(?m)^(?:BEGIN;|COMMIT;|ROLLBACK;)$", body), ["BEGIN;", "COMMIT;"])
                self.assertLess(body.index("pg_advisory_xact_lock"), body.index("SET LOCAL ROLE scrum101_owner"))
                self.assertIn(f"convivencia_stage = '{stage}';\n\\ir checks/convivencia-shape.sql", body)
                self.assertIn(f"convivencia_stage = '{stage + 1}';\n\\ir checks/convivencia-shape.sql", body)
                for source in step["sources"]:
                    self.assertEqual(source["revision"], "9dc8f10")
                    self.assertEqual(hashlib.sha256(read(source["path"]).encode()).hexdigest(), source["sha256_lf"])

    def test_deployed_ddl_and_backfills_match_historical_sources(self):
        history = [[read(source["path"]).splitlines() for source in step["sources"]] for step in self.steps]
        base, extensions, messaging = [read(step["entrypoint"]) for step in self.steps]
        self.assertIn("\n".join(history[0][0][15:87]), base)
        self.assertIn("\n".join(history[1][0][2:18]), extensions)
        self.assertIn("\n".join(history[1][1][2:5]).replace(" ADD COLUMN IF NOT EXISTS ", " ADD COLUMN "), extensions)
        self.assertIn("\n".join(history[2][0][3:26]), messaging)
        self.assertLess(extensions.index("LOCK TABLE"), extensions.index("UPDATE convivencia_mensajeria.arriendo"))
        self.assertLess(messaging.index("LOCK TABLE"), messaging.index("INSERT INTO"))
        self.assertNotRegex(extensions, r"(?im)^UPDATE\s+convivencia_mensajeria\.pertenencia\b")
        self.assertEqual(re.findall(r"(?im)^INSERT INTO (\S+)", messaging), ["convivencia_mensajeria.conversacion(id_arriendo)"])

    def test_verifiers_and_runtime_privilege_boundary(self):
        catalog = read("checks/convivencia-shape.sql")
        target = read("checks/convivencia-target.sql")
        self.assertIn("session_user <> 'scrum101_admin'", target)
        self.assertIn(":'scrum101_system_id'", target)
        self.assertIn("SELECT system_identifier::text FROM pg_control_system()", target)
        for term in ("pg_sequence", "pg_constraint", "pg_attrdef", "pg_index", "pg_trigger",
                     "pg_policy", "aclexplode", "has_any_column_privilege", "has_sequence_privilege"):
            self.assertIn(term, catalog)
        for step in self.steps:
            body, verify = read(step["entrypoint"]), read(step["verify"])
            self.assertNotRegex(body, r"(?im)^\s*(GRANT|CREATE POLICY|ALTER ROLE|CREATE ROLE|DELETE|COPY)\b")
            self.assertNotRegex(body, r"(?im)^\s*(CREATE|ALTER|UPDATE|INSERT INTO|LOCK TABLE)\s+(?:TABLE\s+)?(?:auth_users|listado_applications|match_conexion|reportes)\.")
            self.assertTrue(verify.startswith("\\set ON_ERROR_STOP on\nBEGIN TRANSACTION READ ONLY;\n"))
            self.assertTrue(verify.endswith("ROLLBACK;\n"))
            self.assertEqual(includes(step["verify"]), step["includes"][:-1])
            self.assertNotRegex(verify + catalog, r"(?im)^\s*(CREATE|ALTER|DROP|GRANT|REVOKE|INSERT|UPDATE|DELETE)\s")

    def test_catalog_expression_reference_rejects_drift(self):
        catalog = read("checks/convivencia-shape.sql")
        accepted = re.findall(r"\$expr\$(.*?)\$expr\$", catalog)
        self.assertIn("IS NOT DISTINCT FROM item.predicate", catalog)
        self.assertIn("= item.expression", catalog)
        self.assertNotRegex(catalog, r"strpos\(|LIKE item\.expression")
        for original, changed in (
            ("estado = 'Activa'::text", "estado <> 'Activa'::text"),
            ("estado = 'Activa'::text", "estado = 'Activa'::text OR true"),
            ("id_usuario > 0", "id_usuario >= 0"),
            ("version_ocupacion >= 0", "version_ocupacion >= 1"),
            ("length(btrim(nombre_remitente)) >= 1 AND length(btrim(nombre_remitente)) <= 200",
             "length(btrim(nombre_remitente)) >= 1 AND length(btrim(nombre_remitente)) <= 20"),
        ):
            with self.subTest(changed=changed):
                self.assertIn(original, accepted)
                self.assertNotIn(changed, accepted)
        self.assertIn("am.amname = 'btree'", catalog)
        self.assertIn("i.indoption[1] = CASE WHEN item.key2 LIKE '%DESC' THEN 3 ELSE 0 END", catalog)
        self.assertNotIn("item.key2 LIKE '%DESC' THEN 0", catalog)
        self.assertIn("i.indnkeyatts = i.indnatts", catalog)

    def test_function_and_sequence_reference_rejects_drift(self):
        catalog = read("checks/convivencia-shape.sql")
        accepted = [body.strip() for body in re.findall(r"\$body\$(.*?)\$body\$", catalog, re.S)]
        source = [re.search(r"\bAS \$\$(.*?)\$\$;", read(step["entrypoint"]), re.S)[1].strip()
                  for step in self.steps[:2]]
        self.assertEqual(accepted, source)
        self.assertNotIn(source[0].replace("ocupados>=capacidad", "ocupados>capacidad"), accepted)
        self.assertNotIn(source[1].replace("clock_timestamp()", "OLD.creada_en"), accepted)
        for guard in ("btrim(p.prosrc", "t.tgqual IS NULL", "t.tgnargs = 0", "t.tgattr::text = CASE",
                      "t.tgfoid = fn", "t.tgtype = item.event_mask", "d.deptype = 'i'"):
            self.assertIn(guard, catalog)
        params = re.search(r"\(seqstart, seqincrement, seqmin, seqmax, seqcache, seqcycle\)\s*= \(([^)]+)\)", catalog)[1]
        self.assertEqual(params, "1, 1, 1, 9223372036854775807, 1, false")
        for changed in ("1, 2, 1, 9223372036854775807, 1, false",
                        "1, 1, 1, 9223372036854775807, 5, false",
                        "1, 1, 1, 9223372036854775807, 1, true"):
            self.assertNotEqual(params, changed)

    def test_catalog_acl_rejects_unapproved_grantee_and_grantor(self):
        catalog = read("checks/convivencia-shape.sql")
        for acl in ("n.nspacl", "c.relacl", "att.attacl", "p.proacl"):
            with self.subTest(acl=acl):
                clause = catalog.split(acl, 1)[1].split(")", 5)
                following = ")".join(clause[:5])
                self.assertIn("a.grantee <> owner_role OR a.grantor <> owner_role", following)
        owner, foreign = 10001, 10002
        for grantee, grantor, rejected in ((owner, owner, False), (foreign, owner, True),
                                          (0, owner, True), (owner, foreign, True)):
            self.assertEqual(grantee != owner or grantor != owner, rejected)

    def test_plpgsql_if_does_not_terminate_at_case_then(self):
        # Model the PostgreSQL 17.6 condition scanner. Quoted bodies and strings
        # are opaque. The first THEN outside brackets ends a PL/pgSQL condition.
        def exposed_cases(body):
            tokens = re.finditer(
                r"(?P<comment>--[^\n]*)|(?P<dollar>\$(?:[a-zA-Z_]\w*)?\$).*?(?P=dollar)"
                r"|'(?:''|[^'])*'|\"(?:\"\"|[^\"])*\"|[A-Za-z_]\w*|[^\s]",
                body, re.S,
            )
            depth = 0
            in_condition = False
            previous = ""
            for match in tokens:
                if match.group("comment"):
                    continue
                token = match.group().upper()
                if token in ("(", "["):
                    depth += 1
                elif token in (")", "]"):
                    depth -= 1
                    if depth < 0:
                        raise AssertionError("Delimitador inesperado")
                elif depth == 0:
                    if token in ("IF", "ELSIF") and previous != "END":
                        in_condition = True
                    elif token == "CASE" and in_condition:
                        yield body.count("\n", 0, match.start()) + 1
                    elif token == "THEN":
                        in_condition = False
                previous = token
            if depth or in_condition:
                raise AssertionError("Condición o delimitador sin cerrar")

        self.assertEqual(list(exposed_cases("IF n <> CASE WHEN s = 3 THEN 6 ELSE 4 END THEN NULL; END IF;")), [1])
        self.assertEqual(list(exposed_cases("IF n <> (CASE WHEN s = 3 THEN 6 ELSE 4 END) THEN NULL; END IF;")), [])
        self.assertEqual(list(exposed_cases("IF EXISTS (SELECT 1 WHERE n = CASE WHEN s THEN 1 ELSE 0 END) THEN NULL; END IF;")), [])
        for path in ("checks/convivencia-shape.sql", "checks/convivencia-target.sql"):
            with self.subTest(path=path):
                parts = read(path).split("$check$")
                self.assertEqual(len(parts), 3)
                self.assertTrue(parts[0].rstrip().endswith("DO"))
                self.assertEqual(parts[2].strip(), ";")
                self.assertTrue(parts[1].rstrip().endswith("END;"))
                self.assertEqual(list(exposed_cases(parts[1])), [])


class ConvivenciaAclContract(unittest.TestCase):
    step = next(item for item in MANIFEST["steps"] if item["id"] == "053")

    def test_migration_and_verifier_are_stage_specific(self):
        entry = self.step["entrypoint"]
        body, verify = read(entry), read(self.step["verify"])
        self.assertEqual(self.step["requires"], ["052"])
        self.assertEqual(self.step["status"], "prepared-not-executed")
        self.assertEqual(includes(entry), self.step["includes"])
        precondition = "\\ir checks/convivencia-shape.sql"
        postcondition = "\\ir checks/convivencia-permissions.sql"
        self.assertEqual(body.count(precondition), 1)
        self.assertIn("SET LOCAL scrum101.convivencia_stage = '3';\n" + precondition, body)
        self.assertLess(body.index(precondition), body.index("GRANT USAGE"))
        self.assertIn("RESET ROLE;\n" + postcondition + "\nCOMMIT;", body)
        self.assertTrue(body.startswith("\\set ON_ERROR_STOP on\nBEGIN;\n"))
        self.assertEqual(re.findall(r"(?m)^(BEGIN;|COMMIT;|ROLLBACK;)$", body), ["BEGIN;", "COMMIT;"])
        self.assertEqual(includes(self.step["verify"]),
                         [path for path in self.step["includes"] if path != "checks/convivencia-shape.sql"])
        self.assertTrue(verify.startswith("\\set ON_ERROR_STOP on\nBEGIN TRANSACTION READ ONLY;\n"))
        self.assertTrue(verify.endswith(postcondition + "\nROLLBACK;\n"))
        self.assertNotRegex(verify + read("checks/convivencia-permissions.sql"),
                            r"(?im)^\s*(CREATE|ALTER|GRANT|REVOKE|INSERT|UPDATE|DELETE|TRUNCATE)\s")

    def test_exact_permissions_and_partial_update_policy(self):
        body = read(self.step["entrypoint"])
        tables = ("incorporacion", "arriendo", "pertenencia", "outbox", "conversacion", "mensaje")
        self.assertEqual(tuple(re.findall(
            r"(?m)^ALTER TABLE convivencia_mensajeria\.(\w+) ENABLE ROW LEVEL SECURITY;$", body)), tables)
        self.assertEqual(len(re.findall(r"(?m)^CREATE POLICY ", body)), 16)
        self.assertNotRegex(body, r"(?im)^\s*GRANT\s+(ALL|CREATE|DELETE|TRUNCATE|TRIGGER|EXECUTE)\b")
        self.assertNotRegex(body, r"(?im)^\s*GRANT[^;]+ON\s+(SEQUENCE|FUNCTION)\b")
        self.assertNotRegex(body, r"(?im)SECURITY DEFINER|GRANT OPTION|FOR ALL TO|FORCE ROW LEVEL SECURITY")
        self.assertRegex(body, r"(?s)UPDATE \(estado\)\s+ON convivencia_mensajeria\.pertenencia")
        self.assertIn("USING (estado = 'Activa') WITH CHECK (false);", body)
        catalog = read("checks/convivencia-permissions.sql")
        for term in ("has_column_privilege", "has_sequence_privilege", "has_function_privilege",
                     "NOT acl.is_grantable", "acl.grantor <> owner_oid", "p.polpermissive",
                     "p.polroles = ARRAY[runtime_oid]", "p.polcmd::text = expected.action",
                     "IS NOT DISTINCT FROM expected.write_check", "relforcerowsecurity"):
            self.assertIn(term, catalog)
        self.assertIn("count(*) FROM pg_policy WHERE polrelid = tbl", catalog)

    def test_behavior_and_concurrency_are_opt_in(self):
        path = self.step["behavior"]
        body = read(path)
        self.assertEqual(includes(path), ["../" + f for f in includes(self.step["verify"])])
        self.assertTrue(body.startswith("\\set ON_ERROR_STOP on\nBEGIN;\n"))
        self.assertTrue(body.endswith("ROLLBACK;\n"))
        self.assertNotRegex(body, r"(?im)^\s*(COMMIT|CREATE|ALTER|DROP|TRUNCATE|GRANT|REVOKE)\b")
        for term in ("FOR SHARE", "FOR UPDATE SKIP LOCKED", "RETURNING", "ON CONFLICT",
                     "SET estado=estado", "WHEN insufficient_privilege", "WHEN unique_violation",
                     "WHEN check_violation", "Capacidad agotada", "GET DIAGNOSTICS affected = ROW_COUNT",
                     "row_security','off'", "currval(", "SET LOCAL ROLE sql_convivencia_mensajeria"):
            self.assertIn(term, body)
        concurrency = read(self.step["concurrency"])
        for term in ("pg_blocking_pids", "lock_timeout", "statement_timeout", "COMMIT", "ROLLBACK",
                     "Envío antes del retiro", "Retiro antes del envío", "Última plaza", "SKIP LOCKED"):
            self.assertIn(term, concurrency)

    def test_membership_rls_denials_require_specific_diagnostics_and_postconditions(self):
        body = read(self.step["behavior"])
        self.assertIn("SET LOCAL lc_messages = 'C';", body)
        cases = (
            ("UPDATE no rechazado sobre pertenencia activa",
             'new row violates row-level security policy for table "pertenencia"',
             "Cambió la pertenencia activa tras el rechazo"),
            ("row_security=off eludió RLS",
             'query would be affected by row-level security policy for table "pertenencia"',
             "row_security=off alteró la configuración o la fila"),
        )
        for marker, expected, postcondition in cases:
            with self.subTest(marker=marker):
                after_update = body.split(marker, 1)[1]
                handler, following = after_update.split("END;", 1)
                self.assertIn("RETURNED_SQLSTATE", handler)
                self.assertIn("MESSAGE_TEXT", handler)
                self.assertIn("IS DISTINCT FROM '42501'", handler)
                self.assertIn(expected, handler)
                self.assertNotIn('permission denied for table "arriendo"', handler)
                self.assertIn("AND terminada_en IS NOT DISTINCT FROM prior_end",
                              following.split(postcondition, 1)[0])
        self.assertEqual(body.count("INTO STRICT membership_id,prior_state,prior_end"), 2)
        self.assertEqual(body.count("has_column_privilege(current_user,'convivencia_mensajeria.pertenencia','estado','UPDATE')"), 2)
        self.assertIn("FOREACH noop IN ARRAY ARRAY[false,true] LOOP", body)

    def test_concurrent_send_requires_exactly_one_locked_membership(self):
        runbook = read(self.step["concurrency"])
        send = runbook.split("DO $send$", 1)[1].split("$send$;", 1)[0]
        lock = re.search(r"(?s)SELECT id_pertenencia INTO STRICT membership .*? FOR SHARE;", send)
        self.assertIsNotNone(lock)
        self.assertIn("AND estado='Activa'", lock[0])
        self.assertLess(lock.end(), send.index("INSERT INTO convivencia_mensajeria.mensaje"))
        self.assertNotRegex(send, r"\bEXCEPTION\b")
        self.assertIn("más de una fila", runbook)
        self.assertIn("pg_blocking_pids", runbook)

    def test_structural_snapshot_detects_changes_without_object_count_drift(self):
        import runpy

        snapshot = read("checks/convivencia-structure-snapshot.sql")
        self.assertTrue(snapshot.startswith("\\set ON_ERROR_STOP on\nBEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;\n"))
        self.assertEqual(includes("checks/convivencia-structure-snapshot.sql"), ["target.sql", "convivencia-target.sql"])
        self.assertTrue(snapshot.endswith("ROLLBACK;\n"))
        for definition in ("pg_get_constraintdef", "pg_get_indexdef", "pg_get_functiondef",
                           "pg_get_triggerdef", "pg_get_serial_sequence", "pg_attrdef", "pg_sequence"):
            self.assertIn(definition, snapshot)
        self.assertNotRegex(snapshot, r"(?im)^\s*(CREATE|ALTER|DROP|INSERT|UPDATE|DELETE|GRANT|REVOKE)\b")
        self.assertNotIn("pg_policy", snapshot)
        comparator = runpy.run_path(str(ROOT / "checks/compare_convivencia_structure.py"))
        before = {key: [{"definition": "original"}] for key in comparator["SECTIONS"]}
        before.update(format="scrum101-convivencia-v1", identity={"system_identifier": "1"}, schema={"name": "fixture"})
        rearranged = json.loads(json.dumps(before, sort_keys=True, indent=2))
        self.assertEqual(comparator["differences"](before, rearranged), [])
        for key in comparator["SECTIONS"]:
            with self.subTest(key=key):
                after = {**before, key: [{"definition": "modified"}]}
                self.assertEqual(len(before[key]), len(after[key]))
                self.assertEqual(comparator["differences"](before, after), [key])


class ConvivenciaConcurrencyContract(unittest.TestCase):
    def test_confirmations_require_observed_blocking(self):
        runbook = read("tests/convivencia-concurrency.md")
        gate = read("tests/convivencia-concurrency-gate.sql")
        success, failure = gate.rsplit("\\else", 1)
        self.assertIn("\\if :gate_ok", success)
        self.assertIn("COMMIT;", success)
        self.assertNotIn("COMMIT;", failure)
        self.assertIn("ROLLBACK;", failure)
        self.assertIn("\\quit", failure)
        self.assertIn("pg_blocking_pids(b.pid) = ARRAY[a.pid]", gate)
        self.assertIn("convivencia-concurrency-gate.sql", runbook)
        self.assertEqual(runbook.count("00000000-0000-4000-8000-000000953601"), 1)
        self.assertIn("ROLLBACK de B", runbook)
        self.assertIn("B termina con ROLLBACK sin lanzar INSERT", runbook)
        self.assertIn("Exigir `INSERT 0 1` en A antes de iniciar B", runbook)

    def test_cleanup_is_fingerprint_bound_and_exactly_scoped(self):
        path = "tests/convivencia-concurrency-cleanup.sql"
        body = read(path)
        self.assertEqual(includes(path), [
            "../checks/target.sql", "../checks/convivencia-target.sql", "../checks/provisioned.sql",
            "../checks/convivencia-permissions.sql", "convivencia-concurrency-inventory.sql",
        ])
        self.assertIn(":'approved_fixture_sha256'", body)
        self.assertLess(body.index("LOCK TABLE"), body.index("\\ir convivencia-concurrency-inventory.sql"))
        self.assertLess(body.index("scrum101.cleanup_sha256') <>"), body.index("DELETE FROM"))
        self.assertIn("src.relnamespace <> ref.relnamespace", body)
        self.assertIn("k.confdeltype <> 'a'", body)
        self.assertIn("(t.tgtype & 8) <> 0", body)
        self.assertEqual(re.findall(r"(?m)^    DELETE FROM convivencia_mensajeria\.(\w+)", body),
                         ["mensaje", "outbox", "pertenencia", "conversacion", "arriendo", "incorporacion"])
        self.assertEqual(re.findall(r"IF affected <> (\d+) THEN", body), ["1", "2", "3", "2", "3", "6"])
        self.assertEqual(re.findall(r"(?m)^(BEGIN;|COMMIT;|ROLLBACK;)$", body), ["BEGIN;", "COMMIT;"])
        self.assertNotRegex(body, r"(?i)\b(TRUNCATE|DROP|CASCADE|setval|RESTART IDENTITY)\b")
        inventory = read("tests/convivencia-concurrency-inventory.sql")
        self.assertNotRegex(inventory, r"(?im)^\s*(DELETE|UPDATE|INSERT|ALTER|GRANT|REVOKE)\b")
        self.assertNotIn("sha256", inventory)
        self.assertIn("sha256(convert_to(:'fixture_rows','UTF8'))", body)

    def test_session_gate_rejects_recycled_pid_and_unrelated_wait(self):
        gate = read("tests/convivencia-concurrency-gate.sql")
        session = read("tests/convivencia-concurrency-session.sql")
        for required in (
            "a.pid = r.pid_a AND a.backend_start = r.start_a",
            "b.pid = r.pid_b AND b.backend_start = r.start_b",
            "r.pid_a = pg_backend_pid()", "b.wait_event_type = 'Lock'",
            "a.application_name = 'c053-' || r.nonce", "b.application_name = 'c053-' || r.nonce",
            "a.datname = current_database() AND b.datname = current_database()",
            "pg_blocking_pids(b.pid) = ARRAY[a.pid]",
            "pg_blocking_pids(b.pid) = ARRAY[]::integer[]",
        ):
            self.assertIn(required, gate)
        self.assertIn("current_user::text = CASE", session)
        self.assertIn("AS scenario_marker", session)
        self.assertIn("'application_name'", session)

        # Model the server-side predicate on synthetic observations, without a database.
        registered_a = (101, "start-a", "c053-nonce-1-A-r")
        registered_b = (102, "start-b", "c053-nonce-1-B-o")

        def can_confirm(observed_a, observed_b, blockers):
            return observed_a == registered_a and observed_b == registered_b and blockers == [101]

        self.assertTrue(can_confirm(registered_a, registered_b, [101]))
        self.assertFalse(can_confirm(registered_a, (102, "new-start", registered_b[2]), [101]))
        self.assertFalse(can_confirm(registered_a, (102, "start-b", "foreign-mark"), [101]))
        self.assertFalse(can_confirm((201, "foreign-a", "foreign-mark"),
                                     (202, "foreign-b", "foreign-mark"), [201]))
        self.assertFalse(can_confirm(registered_a, registered_b, [101, 201]))
        self.assertFalse(can_confirm(registered_a, None, []))

    def test_exact_inventory_rejects_extra_rows_replaced_keys_and_wrong_state(self):
        from copy import deepcopy
        import runpy

        tool = runpy.run_path(str(ROOT / "tests/validate_convivencia_concurrency.py"))
        key, validate = tool["key"], tool["validate"]
        t = "2026-11-26T01:23:00+00:00"
        prepared = {
            "incorporacion": [
                dict(id_operacion=key(i), payload={"scrum101": "053-concurrency"},
                     etapa="ValidarIdentidad", estado="Pendiente", http_status=None,
                     respuesta=None, creada_en=t, ultimo_intento=None)
                for i in range(953101, 953107)
            ],
            "arriendo": [
                dict(id_arriendo=80+i, id_publicacion=953200+i, cupos_totales=1,
                     version_capacidad=1, version_ocupacion=0, creado_en=t) for i in (1, 2, 3)
            ],
            "pertenencia": [
                dict(id_pertenencia=90+i, id_arriendo=80+i, id_usuario=953300+i,
                     id_postulacion=953400+i, id_operacion=key(953100+i),
                     estado="Activa", creada_en=t, terminada_en=None) for i in (1, 2)
            ],
            "conversacion": [dict(id_conversacion=100+i, id_arriendo=80+i, creada_en=t) for i in (1, 2)],
            "outbox": [
                dict(id_outbox=i, id_operacion=key(number), accion=action, reserva={},
                     enviado=False, ultimo_intento=None)
                for i, number, action in ((8, 953105, "Confirmar"), (9, 953106, "Liberar"))
            ],
            "mensaje": [],
        }
        prior = validate("semilla", prepared)
        sent = deepcopy(prepared)
        sent["mensaje"].append(dict(id_mensaje=71, id_conversacion=101, id_remitente=953301,
                                    nombre_remitente="Actor sintético", contenido="Envío previo",
                                    id_cliente=key(953601), fecha_envio=t))
        prior = validate("envio", sent, prior)
        retired = deepcopy(sent)
        retired["pertenencia"][1].update(estado="Inactiva", terminada_en=t)
        prior = validate("retiro", retired, prior)
        occupied = deepcopy(retired)
        occupied["pertenencia"].append(dict(id_pertenencia=94, id_arriendo=83, id_usuario=953303,
                                           id_postulacion=953403, id_operacion=key(953103),
                                           estado="Activa", creada_en=t, terminada_en=None))
        prior = validate("cupo", occupied, prior)
        self.assertEqual(validate("skip-locked", occupied, prior), occupied)
        for change in (
            lambda snapshot: snapshot["outbox"].append(dict(snapshot["outbox"][0], id_outbox=1000)),
            lambda snapshot: snapshot["mensaje"][0].update(id_mensaje=999),
            lambda snapshot: snapshot["mensaje"][0].update(id_conversacion=102),
            lambda snapshot: snapshot["pertenencia"][1].update(terminada_en=None),
            lambda snapshot: snapshot["arriendo"].append(snapshot["arriendo"][0]),
            lambda snapshot: snapshot["outbox"].pop(),
        ):
            changed = deepcopy(occupied)
            change(changed)
            with self.assertRaises(ValueError):
                validate("skip-locked", changed, prior)
        self.assertIn("if len(args.captures) == len(STAGES):", read("tests/validate_convivencia_concurrency.py"))


if __name__ == "__main__":
    unittest.main()
