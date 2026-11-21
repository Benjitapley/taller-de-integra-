"""Hace importable el paquete app al ejecutar las pruebas del servicio."""

import sys
from pathlib import Path

service_root = str(Path(__file__).resolve().parents[1])
if service_root not in sys.path:
    sys.path.insert(0, service_root)
