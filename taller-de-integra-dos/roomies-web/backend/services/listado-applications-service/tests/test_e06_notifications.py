"""Aceptación entre servicios sobre la base efímera del runner, sin red externa."""
import os
from pathlib import Path
import subprocess
import sys


def test_e06_auth_notifications_three_sql_pages(database):
    script = Path(__file__).resolve().parents[3] / "local_stack/e06_notifications.py"
    result = subprocess.run([sys.executable, "-I", "-B", str(script)], env=dict(os.environ),
                            capture_output=True, text=True, encoding="utf-8", errors="replace", timeout=40,
                            creationflags=subprocess.CREATE_NO_WINDOW if os.name == "nt" else 0)
    assert result.returncode == 0, result.stdout + result.stderr
