"""QA local reproducible de E06; utiliza dependencias instaladas y PostgreSQL efímero.

No despliega servicios ni acredita el ensayo en Expo físico.
"""
import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
from datetime import datetime, timezone

parser = argparse.ArgumentParser()
parser.add_argument("--browser-executable", type=Path)
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args()
repo = Path(__file__).resolve().parents[4]
webroot = repo / "taller-de-integra-dos/roomies-web"
web = webroot / "frontend-next"
mobile = repo / "taller de integra cuatro/roomies-app-movil"
node = shutil.which("node")
if not node:
    raise SystemExit("Falta Node instalado. No se instalaron dependencias.")
environment = {key: value for key, value in os.environ.items() if key.upper() in {
    "PATH", "SYSTEMROOT", "WINDIR", "TEMP", "TMP", "COMSPEC", "PATHEXT", "USERPROFILE", "LOCALAPPDATA", "APPDATA",
}}
environment["NEXT_TELEMETRY_DISABLED"] = "1"
browser_environment = dict(environment)
if args.browser_executable:
    browser_environment.update(REPORTS_PLAYWRIGHT_PATH=str(web / "node_modules/playwright"),
                               REPORTS_BROWSER_PATH=str(args.browser_executable.resolve()))
jobs = []
for service in ("convivencia-mensajeria-service", "listado-applications-service", "reportes-service"):
    command = [sys.executable, "-I", "-B", str(webroot / f"backend/services/{service}/tests/run_isolated.py")]
    if service == "convivencia-mensajeria-service":
        command += ["--e06-examples", str(args.output.resolve() / "contracts")]
    jobs.append((service, repo, command))
for name, folder in (("expo", mobile), ("web", web)):
    if name == "web":
        jobs.append(("web-route-types", folder, [node, "node_modules/next/dist/bin/next", "typegen"]))
    jobs += [(f"{name}-types", folder, [node, "node_modules/typescript/bin/tsc", "--noEmit"]),
             (f"{name}-lint", folder, [node, "node_modules/eslint/bin/eslint.js", "."]),
             (f"{name}-tests", folder, [node, "--test", "--test-concurrency=1", *map(str, sorted((folder / "tests").glob("*.test.mjs")))])]
if args.browser_executable:
    jobs.append(("e06-browser", web, [node, "--test", "--test-concurrency=1", "tests/tareas-browser.test.mjs", "tests/tareas-mobile-browser.test.mjs"]))
results = []
args.output.mkdir(parents=True, exist_ok=True)
for name, folder, command in jobs:
    print(f"E06: {name}", flush=True)
    result = subprocess.run(command, cwd=folder, env=browser_environment if name == "e06-browser" else environment, capture_output=True, text=True,
                            encoding="utf-8", errors="replace", timeout=900,
                            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
    (args.output / f"{name}.txt").write_text(result.stdout + result.stderr, encoding="utf-8")
    results.append({"check": name, "exit_code": result.returncode})
    print(f"  exit={result.returncode}", flush=True)
summary = {"at": datetime.now(timezone.utc).isoformat(), "scope": "QA local, no aceptación física ni despliegue",
           "browser_enabled": bool(args.browser_executable), "results": results}
(args.output / "summary.json").write_text(json.dumps(summary, indent=2) + "\n", encoding="utf-8")
raise SystemExit(1 if any(row["exit_code"] for row in results) else 0)
