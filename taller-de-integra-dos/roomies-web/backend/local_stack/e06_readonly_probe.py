"""Consulta el Gateway con una cuenta de prueba recibida por stdin; solo GET de negocio.

No imprime credenciales ni datos personales. El login usa el proveedor configurado
en el cliente Expo; nunca crea usuarios, publicaciones, reportes ni arriendos.
"""
import argparse
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
import json
from pathlib import Path
import sys
from urllib.parse import urlsplit
from urllib.parse import urlencode

import httpx

parser = argparse.ArgumentParser()
parser.add_argument("--gateway", required=True)
parser.add_argument("--output", type=Path, required=True)
args = parser.parse_args()
base = args.gateway.rstrip("/")
if urlsplit(base).scheme != "https" or urlsplit(base).query or urlsplit(base).username:
    raise SystemExit("Usa el origen HTTPS del Gateway.")
root = Path(__file__).resolve().parents[4]
mobile = root / "taller de integra cuatro/roomies-app-movil/.env.local"
config = {}
for line in mobile.read_text(encoding="utf-8-sig").splitlines():
    key, sep, value = line.partition("=")
    if sep:
        config[key.strip()] = value.strip().strip('"').strip("'")
account = json.load(sys.stdin)
private_fields = {"nombre", "titulo", "descripcion", "ubicacion", "ciudad", "sobre_mi", "breve_descripcion",
                  "ocupacion", "motivo", "foto", "foto_perfil", "url", "imagen", "imagenes", "contenido", "email", "reglas", "reglas_arrendador"}

def sanitized(value, field=""):
    if isinstance(value, dict):
        return {key: sanitized(item, key) for key, item in value.items()}
    if isinstance(value, list):
        return [sanitized(item, field) for item in value]
    return "[redactado]" if isinstance(value, str) and field in private_fields else value

with httpx.Client(timeout=15, follow_redirects=False, trust_env=False) as client:
    login = client.post(config["EXPO_PUBLIC_SUPABASE_URL"].rstrip("/") + "/auth/v1/token?grant_type=password",
                        headers={"apikey": config["EXPO_PUBLIC_SUPABASE_KEY"]},
                        json={"email": account["email"], "password": account["password"]})
    if login.status_code != 200:
        raise SystemExit(f"Login de cuenta de prueba rechazado: HTTP {login.status_code}.")
    token = login.json()["access_token"]
    paths = ["/usuarios/me", "/api/publicaciones?limite=2", "/api/publicaciones/mias?limite=2",
             "/api/postulaciones/mias?limite=2", "/api/notificaciones?limite=2", "/api/reportes/mios?limite=2",
             "/api/conversaciones?limite=2", "/api/arriendos/mio", "/api/publicaciones?cursor=invalid"]

    def probe(path):
        try:
            response = client.get(base + path, headers={"Authorization": "Bearer " + token})
            try:
                body = response.json()
            except ValueError:
                body = None
            result = {"method": "GET", "path": path, "status": response.status_code}
            if isinstance(body, dict):
                result["fields"] = sorted(body)
                if isinstance(body.get("items"), list):
                    result.update(count=len(body["items"]), has_cursor=bool(body.get("siguiente_cursor")))
                    result["item_fields"] = sorted(body["items"][0]) if body["items"] and isinstance(body["items"][0], dict) else []
                for key in ("code", "codigo"):
                    if isinstance(body.get(key), str):
                        result[key] = body[key]
                if response.is_success:
                    result["response"] = sanitized(body)
            return result
        except httpx.HTTPError:
            return {"method": "GET", "path": path, "status": None, "error": "network_or_timeout"}

    with ThreadPoolExecutor(max_workers=3) as pool:
        checks = list(pool.map(probe, paths))
    catalog = next(check for check in checks if check["path"] == "/api/publicaciones?limite=2")
    first_cursor = catalog.get("response", {}).get("siguiente_cursor")
    cursor = first_cursor
    for _ in range(2):
        if not cursor:
            break
        page = probe("/api/publicaciones?" + urlencode({"limite": 2, "cursor": cursor}))
        checks.append(page)
        cursor = page.get("response", {}).get("siguiente_cursor")
    if first_cursor:
        checks.append(probe("/api/publicaciones/mias?" + urlencode({"limite": 2, "cursor": first_cursor})))
result = {"at": datetime.now(timezone.utc).isoformat(), "environment": "Kubero TEST; HTTP aislado; no aceptación física",
          "gateway": base, "mobile_gateway_matches": config.get("EXPO_PUBLIC_API_URL", "").rstrip("/") == base,
          "checks": checks}
args.output.parent.mkdir(parents=True, exist_ok=True)
args.output.write_text(json.dumps(result, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
print(json.dumps(result, ensure_ascii=True))
