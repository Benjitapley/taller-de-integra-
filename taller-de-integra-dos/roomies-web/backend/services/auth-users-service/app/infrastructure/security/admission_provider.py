"""Habilitación actual en Supabase Auth; la clave administrativa queda en Auth/Users."""
from datetime import datetime, timezone
import os

import httpx

from backend.service_runtime.contracts import DependencyUnavailable
from backend.service_runtime.settings import auth_provider_url


def timestamp(value):
    if value is None:
        return None
    if not isinstance(value, str) or not value:
        raise ValueError()
    parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if parsed.tzinfo is None:
        raise ValueError()
    return parsed


class SupabaseAdmissionIdentity:
    def enabled(self, subject):
        try:
            key = os.environ.get("ROOMIES_SUPABASE_AUTH_ADMIN_KEY", "")
            if len(key) < 32 or not key.isascii() or any(char.isspace() for char in key) or "REPLACE_" in key:
                raise DependencyUnavailable()
            headers = {"apikey": key}
            if not key.startswith("sb_secret_"):
                headers["Authorization"] = "Bearer " + key
            with httpx.Client(timeout=5, trust_env=False, follow_redirects=False) as client:
                response = client.get(f"{auth_provider_url()}/auth/v1/admin/users/{subject}", headers=headers)
            if response.status_code == 404:
                return False
            response.raise_for_status()
            value = response.json()
            if not isinstance(value, dict) or value.get("id") != str(subject):
                raise ValueError()
            email = value.get("email")
            anonymous = value.get("is_anonymous", False)
            if not isinstance(email, str) or type(anonymous) is not bool:
                raise ValueError()
            confirmed = timestamp(value.get("email_confirmed_at"))
            deleted = timestamp(value.get("deleted_at"))
            banned = timestamp(value.get("banned_until"))
            return bool(email.strip()) and confirmed is not None and deleted is None and not anonymous and (banned is None or banned <= datetime.now(timezone.utc))
        except (httpx.HTTPError, ValueError, TypeError, OverflowError):
            raise DependencyUnavailable() from None
