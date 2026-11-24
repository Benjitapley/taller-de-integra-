"""Cliente del proveedor de identidad; no consulta auth.users por SQL."""
import httpx
from backend.service_runtime.settings import auth_provider_url
from backend.service_runtime.contracts import DependencyUnavailable


def provider_user(token, subject):
    try:
        origin = auth_provider_url()
        import os
        key = os.environ.get("ROOMIES_AUTH_PUBLISHABLE_KEY", "")
        if not key or not key.startswith("sb_publishable_") or any(c in key for c in "\r\n"):
            raise DependencyUnavailable()
        with httpx.Client(timeout=5, trust_env=False, follow_redirects=False) as client:
            response = client.get(origin + "/auth/v1/user", headers={"Authorization":"Bearer "+token,"apikey":key})
        if response.status_code == 401:
            from backend.service_runtime.contracts import RuleViolation
            raise RuleViolation("Sesión no vigente.", 401)
        response.raise_for_status()
        value = response.json()
        if not isinstance(value,dict) or value.get("id") != str(subject):
            raise ValueError()
        return value
    except Exception as error:
        from backend.service_runtime.contracts import RuleViolation
        if isinstance(error, RuleViolation):
            raise
        raise DependencyUnavailable() from None


def email_is_confirmed(value):
    return isinstance(value.get("email_confirmed_at"),str) and bool(value["email_confirmed_at"])


def confirmed_email(token, subject):
    return email_is_confirmed(provider_user(token,subject))


def has_admin_role(value):
    metadata=value.get("app_metadata")
    return isinstance(metadata,dict) and metadata.get("rol")=="admin" and value.get("is_anonymous") is not True
