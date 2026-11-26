"""Offline checks for the proposed Reportes phases."""

import hashlib
import json
from pathlib import Path
import re
import unittest


ROOT = Path(__file__).resolve().parents[1]


def read(path):
    return (ROOT / path).read_text(encoding="utf-8")


def includes(body):
    return re.findall(r"^\\ir (\S+)$", body, re.MULTILINE)


class ReportesPhases(unittest.TestCase):
    def test_manifest_order_sources_and_includes(self):
        steps = json.loads(read("manifest.json"))["steps"][-3:]
        self.assertEqual([s["id"] for s in steps], ["060", "061", "062"])
        for step, previous in zip(steps, ("053", "060", "061")):
            self.assertEqual(step["requires"], [previous])
            self.assertEqual(step["status"], "prepared-not-executed")
            entry = read(step["entrypoint"])
            self.assertEqual(list(dict.fromkeys(includes(entry))), step["includes"])
            for source in step["sources"]:
                self.assertEqual(hashlib.sha256(read(source["path"]).encode()).hexdigest(), source["sha256_lf"])
            self.assertEqual(entry.count("\nBEGIN;\n"), 1)
            self.assertEqual(entry.count("\nCOMMIT;\n"), 1)
            self.assertLess(entry.index("reportes-prior.sql"), entry.index("SET LOCAL ROLE"))
            self.assertLess(entry.index("pg_advisory_xact_lock"), entry.index("reportes-catalog.sql"))

    def test_catalog_checkers_and_prior_contract_are_read_only(self):
        prior = read("checks/reportes-prior.sql")
        historical = read("053-convivencia-verify.sql").split("READ ONLY;\n")[1].split("ROLLBACK;")[0]
        self.assertEqual(prior, historical.replace(r"\ir checks/", r"\ir "))
        for file in includes(prior):
            self.assertTrue((ROOT / "checks" / file).is_file())
        for stage in ("060", "061", "062"):
            verifier = read(stage + "-reportes-verify.sql")
            self.assertIn("BEGIN TRANSACTION READ ONLY;", verifier)
            self.assertTrue(verifier.endswith("ROLLBACK;\n"))
        for name in ("reportes-prior.sql", "reportes-catalog.sql"):
            self.assertNotRegex(read("checks/" + name), r"(?im)^\s*(CREATE|ALTER|GRANT|REVOKE|INSERT|UPDATE|DELETE)\s")

    def test_table_ddls_match_historic_sources(self):
        base = read("060-reportes-base.sql")
        extended = read("061-reportes-review-idempotency.sql")
        history = "../../backend/services/reportes-service/migrations/"
        for name, proposal in (("001_reportes", base), ("002_revision", extended), ("003_envio_idempotente", extended)):
            original = read(history + name + ".up.sql")
            for ddl in re.findall(r"^CREATE TABLE .*?\n\);", original, re.MULTILINE | re.DOTALL):
                self.assertIn(ddl, proposal)
        targets = re.findall(r"REFERENCES (\S+)\(", base + extended)
        self.assertEqual(targets, ["reportes.reporte", "reportes.reporte_historial"])
        for body in (base, extended):
            self.assertNotRegex(body, r"(?im)^\s*(CREATE ROLE|GRANT|CREATE POLICY)\b")

    def test_generated_type_normalizes_leading_newline_before_comparison(self):
        catalog = read("checks/reportes-catalog.sql")
        self.assertIn(
            "btrim(regexp_replace(pg_get_expr(d.adbin,d.adrelid,true), '[[:space:]]+', ' ', 'g'))",
            catalog,
        )
        expression = re.search(r"'(CASE WHEN id_usuario_reportado IS NULL .* END)' THEN 'g'", catalog)
        self.assertIsNotNone(expression)
        expected = expression[1].replace("''", "'")
        deparsed = (
            "\nCASE\n    WHEN id_usuario_reportado IS NULL THEN 'Publicacion'::text"
            "\n    ELSE 'Usuario'::text\nEND"
        )
        self.assertNotEqual(re.sub(r"\s+", " ", deparsed.strip(" ")), expected)
        self.assertEqual(re.sub(r"\s+", " ", deparsed).strip(" "), expected)
        changed = deparsed.replace("IS NULL", "IS NOT NULL")
        self.assertNotEqual(re.sub(r"\s+", " ", changed).strip(" "), expected)

    def test_review_transition_check_matches_postgres_17_deparser(self):
        catalog = read("checks/reportes-catalog.sql")
        expected = re.findall(r"\('reporte_historial',\$expr\$(.*?)\$expr\$\)", catalog)
        # ruleutils.c wraps each ScalarArrayOpExpr that is a child of AND.
        deparsed = (
            "estado_anterior = 'Pendiente'::text AND "
            "(estado_nuevo = ANY (ARRAY['En_Revision'::text, 'Descartado'::text])) OR "
            "estado_anterior = 'En_Revision'::text AND "
            "(estado_nuevo = ANY (ARRAY['Resuelto'::text, 'Descartado'::text]))"
        )
        previous = re.sub(r"\((estado_nuevo = ANY \(ARRAY\[.*?\]\))\)", r"\1", deparsed)
        self.assertNotEqual(previous, deparsed)
        self.assertNotIn(previous, expected)
        self.assertIn(deparsed, expected)
        self.assertNotIn(deparsed.replace("'Resuelto'::text", "'Pendiente'::text"), expected)

    def test_acl_and_policies_are_operation_scoped(self):
        acl = read("062-reportes-acl-rls.sql")
        catalog = read("checks/reportes-catalog.sql")
        for op, cols, table in re.findall(r"^GRANT (SELECT|INSERT|UPDATE) \(([^)]+)\) ON reportes\.(\w+) TO sql_reportes;", acl, re.MULTILINE):
            self.assertIn(f"('{table}','{op}','{cols}')", catalog)
        self.assertEqual(len(re.findall(r"^CREATE POLICY", acl, re.MULTILINE)), 10)
        self.assertIn("GRANT UPDATE (estado) ON reportes.reporte", acl)
        self.assertIn("GRANT UPDATE (proximo_intento,entregado_en) ON reportes.outbox", acl)
        self.assertNotRegex(acl, r"(?i)WITH GRANT OPTION|BYPASSRLS|GRANT ALL|FOR ALL|GRANT DELETE")


if __name__ == "__main__":
    unittest.main()
