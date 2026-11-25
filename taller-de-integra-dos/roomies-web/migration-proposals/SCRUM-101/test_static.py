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
        steps = MANIFEST["steps"][2:]
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
        step = MANIFEST["steps"][-1]
        body = read(step["behavior"])
        self.assertTrue(body.startswith("\\set ON_ERROR_STOP on\nBEGIN;\n"))
        self.assertTrue(body.endswith("ROLLBACK;\n"))
        self.assertNotIn("COMMIT;", body)
        for path in includes(step["behavior"]):
            self.assertTrue((ROOT / "tests" / path).is_file())


if __name__ == "__main__":
    unittest.main()
