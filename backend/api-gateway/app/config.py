import math
import os
from dataclasses import dataclass
from urllib.parse import urlsplit

import httpx


@dataclass(frozen=True)
class Settings:
    upstream: str | None = None
    connect_timeout: float = 3.0
    read_timeout: float = 10.0
    write_timeout: float = 10.0
    pool_timeout: float = 3.0
    client_body_timeout: float = 5.0
    total_timeout: float = 15.0
    max_request_bytes: int = 1_048_576
    max_response_bytes: int = 2_097_152

    def __post_init__(self):
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
        for value in (self.max_request_bytes, self.max_response_bytes):
            if type(value) is not int or not 0 < value <= 16_777_216:
                raise ValueError("Límite de bytes fuera de rango (0, 16777216].")

    @classmethod
    def from_env(cls):
        try:
            return cls(
                upstream=os.environ.get("AUTH_USERS_UPSTREAM_URL") or None,
                **{f"{kind}_timeout": float(os.environ.get(f"GATEWAY_{kind.upper()}_TIMEOUT", default))
                   for kind, default in (("connect", "3"), ("read", "10"), ("write", "10"),
                                         ("pool", "3"), ("client_body", "5"), ("total", "15"))},
                max_request_bytes=int(os.environ.get("GATEWAY_MAX_REQUEST_BYTES", "1048576")),
                max_response_bytes=int(os.environ.get("GATEWAY_MAX_RESPONSE_BYTES", "2097152")),
            )
        except (ValueError, OverflowError):
            raise ValueError("Configuración del Gateway inválida.") from None
