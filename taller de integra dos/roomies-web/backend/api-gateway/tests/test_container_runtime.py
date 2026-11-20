import os
from pathlib import Path
import runpy

import pytest


runtime = runpy.run_path(str(Path(__file__).resolve().parents[1] / "docker/runtime.py"))


def test_default_container_port(monkeypatch):
    monkeypatch.delenv("PORT", raising=False)
    assert runtime["port"]() == 8000


@pytest.mark.parametrize("value", ["8083", "18083", "65535"])
def test_container_port_is_respected(monkeypatch, value):
    monkeypatch.setenv("PORT", value)
    command = runtime["command"]()
    assert command[command.index("--port") + 1] == value
    assert command[command.index("--host") + 1] == "0.0.0.0"
    assert "--no-access-log" in command and "--no-proxy-headers" in command
    assert "app.main:app" in command


@pytest.mark.parametrize("value", ["0", "65536", "-1", "secret-ficticio", "8000;echo ficticio"])
def test_invalid_container_port_is_not_echoed(monkeypatch, value):
    monkeypatch.setenv("PORT", value)
    with pytest.raises(ValueError) as error:
        runtime["command"]()
    assert value not in str(error.value)


def test_exec_passes_uvicorn_without_shell(monkeypatch):
    seen = []
    monkeypatch.setenv("PORT", "8083")
    monkeypatch.setattr("sys.argv", ["runtime.py", "serve"])
    monkeypatch.setattr(os, "execv", lambda executable, args: seen.append((executable, args)))
    runtime["main"]()
    assert len(seen) == 1
    assert seen[0][1] == runtime["command"]()
