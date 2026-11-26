"""Compare two standalone JSON catalog snapshots of the same cluster."""

import argparse
import json
from pathlib import Path


SECTIONS = ("relations", "columns", "constraints", "indexes", "sequences", "functions", "triggers")
KEYS = {"format", "identity", "schema", *SECTIONS}


def read_snapshot(path):
    snapshot = json.loads(path.read_text(encoding="utf-8-sig"))
    if (
        not isinstance(snapshot, dict) or set(snapshot) != KEYS
        or snapshot["format"] != "scrum101-convivencia-v1"
        or not isinstance(snapshot["identity"], dict)
        or not isinstance(snapshot["schema"], dict) or not snapshot["schema"]
        or any(not isinstance(snapshot[key], list) or not snapshot[key] for key in SECTIONS)
    ):
        raise ValueError("Captura estructural inválida o incompleta")
    return snapshot


def differences(before, after):
    return sorted(key for key in KEYS if before[key] != after[key])


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("before", type=Path)
    parser.add_argument("after", type=Path)
    args = parser.parse_args()
    try:
        changed = differences(read_snapshot(args.before), read_snapshot(args.after))
    except (ValueError, OSError) as exc:
        parser.exit(2, f"No se pudo comparar: {exc}\n")
    if changed:
        parser.exit(1, f"Diferencias estructurales o de identidad: {', '.join(changed)}\n")
    print("Estructura de Convivencia conservada")


if __name__ == "__main__":
    main()
