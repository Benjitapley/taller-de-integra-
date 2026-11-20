"""Fixture HTTP del contrato GoTrue. NO es Supabase ni un login desplegable."""
import json
import secrets
import threading
import time
from datetime import date
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from uuid import uuid4
from urllib.parse import urlsplit, parse_qs

import jwt
from cryptography.hazmat.primitives.asymmetric import ec


class IdentityFixture:
    def __init__(self):
        self.key = ec.generate_private_key(ec.SECP256R1())
        self.users = {}
        self.refreshes = {}
        self.key_id = "disposable-test-key"
        fixture = self

        class Handler(BaseHTTPRequestHandler):
            def log_message(self, *args): pass

            def do_GET(self): self.handle_request()
            def do_POST(self): self.handle_request()

            def handle_request(self):
                try:
                    parsed = urlsplit(self.path)
                    path = parsed.path.removeprefix("/auth/v1")
                    data = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))) or b"{}")
                    if path == "/.well-known/jwks.json":
                        key = json.loads(jwt.algorithms.ECAlgorithm.to_jwk(fixture.key.public_key()))
                        return self.reply(200, {"keys": [{**key, "kid": fixture.key_id, "alg": "ES256", "use": "sig"}]})
                    if self.headers.get("apikey") != fixture.publishable_key:
                        return self.reply(401, {"error": "invalid_key"})
                    if path == "/signup":
                        email = data["email"]
                        assert email.endswith("@example.com")
                        birth = date.fromisoformat(data["data"]["fecha_nacimiento"])
                        age = date.today().year - birth.year - ((date.today().month, date.today().day) < (birth.month, birth.day))
                        if not 18 <= age <= 120: return self.reply(422, {"error": "invalid_age"})
                        if email in fixture.users: return self.reply(422, {"error": "user_exists"})
                        user = {"id": str(uuid4()), "email": email, "user_metadata": data["data"], "email_confirmed_at": None}
                        fixture.users[email] = {"user": user, "password": data["password"], "otp": f"{secrets.randbelow(1000000):06d}"}
                        return self.reply(200, user)
                    if path == "/resend": return self.reply(200, {})
                    if path == "/verify":
                        record = fixture.users.get(data.get("email"))
                        if not record or data.get("token") != record["otp"]: return self.reply(403, {"error": "otp_expired"})
                        record["user"]["email_confirmed_at"] = "2026-01-01T00:00:00Z"
                        return self.reply(200, fixture.session(record["user"]))
                    if path == "/token":
                        grant = parse_qs(parsed.query).get("grant_type", [""])[0]
                        if grant == "refresh_token":
                            previous = fixture.refreshes.pop(data.get("refresh_token"), None)
                            if not previous: return self.reply(400, {"error": "invalid_grant"})
                            return self.reply(200, fixture.session(previous[0], previous[1]))
                        record = fixture.users.get(data.get("email"))
                        if not record or record["password"] != data.get("password") or not record["user"]["email_confirmed_at"]:
                            return self.reply(400, {"error": "invalid_grant"})
                        return self.reply(200, fixture.session(record["user"]))
                    claims = jwt.decode(self.headers.get("Authorization", "").removeprefix("Bearer "), fixture.key.public_key(), algorithms=["ES256"], issuer=fixture.origin + "/auth/v1", audience="authenticated")
                    record = next(r for r in fixture.users.values() if r["user"]["id"] == claims["sub"])
                    if path == "/user": return self.reply(200, record["user"])
                    if path == "/logout":
                        fixture.refreshes = {k: v for k, v in fixture.refreshes.items() if v[1] != claims["session_id"]}
                        return self.reply(204, None)
                    self.reply(404, {})
                except (KeyError, ValueError, AssertionError, StopIteration, jwt.PyJWTError):
                    self.reply(401, {"error": "invalid_request"})

            def reply(self, status, value):
                body = json.dumps(value).encode() if value is not None else b""
                self.send_response(status)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)

        self.publishable_key = "sb_publishable_disposable_test_only"
        self.server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        self.origin = f"http://127.0.0.1:{self.server.server_port}"
        self.thread = threading.Thread(target=self.server.serve_forever, daemon=True)

    def session(self, user, sid=None, **overrides):
        sid = sid or str(uuid4())
        claims = {"sub": user["id"], "session_id": sid, "iat": int(time.time()), "exp": int(time.time()) + 600,
                  "iss": self.origin + "/auth/v1", "aud": "authenticated", **overrides}
        refresh = secrets.token_urlsafe(40)
        self.refreshes[refresh] = (user, sid)
        return {"access_token": jwt.encode(claims, self.key, algorithm="ES256", headers={"kid": self.key_id}),
                "refresh_token": refresh, "token_type": "bearer", "expires_in": 600, "user": user}

    def __enter__(self):
        self.thread.start()
        return self

    def __exit__(self, *_):
        self.server.shutdown()
        self.server.server_close()
        self.thread.join(timeout=5)
