import math
import os
from dataclasses import dataclass
from urllib.parse import urlsplit

import httpx


@dataclass(frozen=True)
class Settings:
    upstream: str | None = None
    listado_upstream: str | None = None
    match_upstream: str | None = None
    convivencia_upstream: str | None = None
    reportes_upstream: str | None = None
    local_mode: bool = False
    connect_timeout: float = 3.0
    read_timeout: float = 10.0
    write_timeout: float = 10.0
    pool_timeout: float = 3.0
    client_body_timeout: float = 5.0
    total_timeout: float = 15.0
    max_request_bytes: int = 1_048_576
    max_response_bytes: int = 2_097_152
    kubero_mode: bool = False

    @property
    def business_routes_enabled(self) -> bool:
        return self.local_mode or self.kubero_mode

    def __post_init__(self):
        for configured in (self.listado_upstream,self.match_upstream,self.convivencia_upstream,self.reportes_upstream):
            if configured is not None:
                Settings(upstream=configured)
        if self.upstream is not None:
            try:
                url = urlsplit(self.upstream)
                valid = (url.scheme in {"http", "https"} and url.hostname
                         and url.username is None and url.password is None
                         and url.path in {"", "/"} and not url.query and not url.fragment
                         and "\\" not in self.upstream
                         and not any(c.isspace() or ord(c) < 32 for c in self.upstream))
                url.port
                httpx.URL(self.upstream)
            except (ValueError, httpx.InvalidURL):
                valid = False
            if not valid:
                raise ValueError("Configuración de upstream inválida.") from None
        for value in (self.connect_timeout, self.read_timeout, self.write_timeout, self.pool_timeout,
                      self.client_body_timeout, self.total_timeout):
            if not math.isfinite(value) or not 0 < value <= 120:
                raise ValueError("Timeout fuera de rango (0, 120].")
        for value, maximum in ((self.max_request_bytes, 32_000_000), (self.max_response_bytes, 16_777_216)):
            if type(value) is not int or not 0 < value <= maximum:
                raise ValueError("Límite de bytes fuera de rango.")

    @classmethod
    def from_env(cls):
        try:
            runtime_mode = os.environ.get("ROOMIES_RUNTIME_MODE")
            kubero_mode = runtime_mode == "kubero"
            local_mode = not kubero_mode and (
                os.environ.get("ROOMIES_LOCAL_MODE") == "1" or runtime_mode == "supabase"
            )
            business_routes_enabled = local_mode or kubero_mode
            return cls(
                upstream=os.environ.get("AUTH_USERS_UPSTREAM_URL") or None,
                listado_upstream=os.environ.get("LISTADO_UPSTREAM_URL") or None,
                match_upstream=os.environ.get("MATCH_UPSTREAM_URL") or None,
                convivencia_upstream=os.environ.get("CONVIVENCIA_UPSTREAM_URL") or None,
                reportes_upstream=os.environ.get("REPORTES_UPSTREAM_URL") or None,
                local_mode=local_mode,
                kubero_mode=kubero_mode,
                **{f"{kind}_timeout": float(os.environ.get(f"GATEWAY_{kind.upper()}_TIMEOUT", default))
                   for kind, default in (("connect", "3"), ("read", "10"), ("write", "10"),
                                         ("pool", "3"), ("client_body", "5"), ("total", "15"))},
                max_request_bytes=int(os.environ.get("GATEWAY_MAX_REQUEST_BYTES", "26000000" if business_routes_enabled else "1048576")),
                max_response_bytes=int(os.environ.get("GATEWAY_MAX_RESPONSE_BYTES", "6291456" if business_routes_enabled else "2097152")),
            )
        except (ValueError, OverflowError):
            raise ValueError("Configuración del Gateway inválida.") from None
