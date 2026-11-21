"""Cryptographic ES256 checks for the Supabase JWT verifier, entirely offline."""

from copy import deepcopy
from datetime import datetime, timedelta, timezone
from time import monotonic
from uuid import UUID, uuid4

import jwt
import pytest
from cryptography.hazmat.primitives.asymmetric import ec

from app.domain.identity import VerifiedIdentity
from app.infrastructure.security.supabase_jwt import (
    InvalidAccessToken,
    SupabaseJWTVerifier,
)
from app.infrastructure.settings import SupabaseJWTSettings


ISSUER = "https://roomies-test.invalid/auth/v1"
AUDIENCE = "authenticated"
JWKS_URL = f"{ISSUER}/.well-known/jwks.json"


class InMemoryJWKSClient(jwt.PyJWKClient):
    """Use PyJWT's real JWK parsing and key selection without network access."""

    def __init__(self, jwks: dict, *, cooldown_duration: float = 0) -> None:
        super().__init__(
            JWKS_URL,
            timeout=1,
            lifespan=300,
            cooldown_duration=cooldown_duration,
        )
        self.jwks = deepcopy(jwks)
        self.fetch_count = 0

    def fetch_data(self):
        self.fetch_count += 1
        self._last_successful_fetch = monotonic()
        return deepcopy(self.jwks)


def generate_es256_key(kid: str) -> tuple[ec.EllipticCurvePrivateKey, dict]:
    private_key = ec.generate_private_key(ec.SECP256R1())
    public_jwk = jwt.algorithms.ECAlgorithm.to_jwk(
        private_key.public_key(), as_dict=True
    )
    public_jwk.update({"kid": kid, "alg": "ES256", "use": "sig"})
    return private_key, public_jwk


def make_settings(
    *,
    issuer: str = ISSUER,
    audience: str = AUDIENCE,
    algorithms: tuple[str, ...] = ("ES256",),
) -> SupabaseJWTSettings:
    return SupabaseJWTSettings(
        jwks_url=JWKS_URL,
        issuer=issuer,
        audience=audience,
        algorithms=algorithms,
    )


def make_token(
    private_key: ec.EllipticCurvePrivateKey,
    *,
    kid: str,
    sub: str | None = None,
    issuer: str = ISSUER,
    audience: str = AUDIENCE,
    expires_at: datetime | None = None,
) -> str:
    now = datetime.now(timezone.utc)
    claims = {
        "sub": sub or str(uuid4()),
        "iss": issuer,
        "aud": audience,
        "exp": int((expires_at or now + timedelta(minutes=5)).timestamp()),
        "iat": int((now - timedelta(seconds=5)).timestamp()),
    }
    return jwt.encode(
        claims,
        private_key,
        algorithm="ES256",
        headers={"kid": kid, "typ": "JWT"},
    )


def make_verifier(
    jwks: dict,
    *,
    resolver: InMemoryJWKSClient | None = None,
    settings: SupabaseJWTSettings | None = None,
) -> tuple[SupabaseJWTVerifier, InMemoryJWKSClient]:
    client = resolver or InMemoryJWKSClient(jwks)
    return SupabaseJWTVerifier(settings or make_settings(), client), client


def alter_signature(token: str) -> str:
    header, payload, encoded_signature = token.split(".")
    signature = bytearray(jwt.utils.base64url_decode(encoded_signature.encode("ascii")))
    signature[0] ^= 0x01
    altered = jwt.utils.base64url_encode(bytes(signature)).decode("ascii").rstrip("=")
    return f"{header}.{payload}.{altered}"


def test_real_es256_signature_verifies_and_returns_supabase_uuid():
    private_key, public_jwk = generate_es256_key("ephemeral-current")
    expected_id = uuid4()
    token = make_token(private_key, kid="ephemeral-current", sub=str(expected_id))
    verifier, client = make_verifier({"keys": [public_jwk]})

    assert verifier.verify(token) == VerifiedIdentity(supabase_user_id=expected_id)
    assert client.fetch_count == 1


def test_real_es256_signature_alteration_is_rejected():
    private_key, public_jwk = generate_es256_key("ephemeral-signature")
    token = make_token(private_key, kid="ephemeral-signature")
    verifier, _ = make_verifier({"keys": [public_jwk]})

    with pytest.raises(InvalidAccessToken):
        verifier.verify(alter_signature(token))


def test_real_es256_expired_token_is_rejected():
    private_key, public_jwk = generate_es256_key("ephemeral-expired")
    token = make_token(
        private_key,
        kid="ephemeral-expired",
        expires_at=datetime.now(timezone.utc) - timedelta(seconds=10),
    )
    verifier, _ = make_verifier({"keys": [public_jwk]})

    with pytest.raises(InvalidAccessToken):
        verifier.verify(token)


@pytest.mark.parametrize(
    ("claim", "configured_value"),
    [("iss", "https://another-test.invalid/auth/v1"),
     ("aud", "another-test-audience")],
)
def test_real_es256_wrong_issuer_or_audience_is_rejected(claim, configured_value):
    private_key, public_jwk = generate_es256_key(f"ephemeral-{claim}")
    token_options = {"issuer": ISSUER, "audience": AUDIENCE}
    token_options["issuer" if claim == "iss" else "audience"] = configured_value
    token = make_token(private_key, kid=f"ephemeral-{claim}", **token_options)
    verifier, _ = make_verifier({"keys": [public_jwk]})

    with pytest.raises(InvalidAccessToken):
        verifier.verify(token)


def test_real_es256_token_with_invalid_uuid_subject_is_rejected():
    private_key, public_jwk = generate_es256_key("ephemeral-invalid-uuid")
    token = make_token(
        private_key, kid="ephemeral-invalid-uuid", sub="not-a-roomies-uuid"
    )
    verifier, _ = make_verifier({"keys": [public_jwk]})

    with pytest.raises(InvalidAccessToken):
        verifier.verify(token)


def test_real_es256_token_with_disallowed_algorithm_is_rejected():
    private_key, public_jwk = generate_es256_key("ephemeral-disallowed-alg")
    token = make_token(private_key, kid="ephemeral-disallowed-alg")
    verifier, _ = make_verifier(
        {"keys": [public_jwk]}, settings=make_settings(algorithms=("RS256",))
    )

    with pytest.raises(InvalidAccessToken):
        verifier.verify(token)


def test_real_es256_token_with_unknown_kid_is_rejected_after_jwks_refresh():
    signing_key, _ = generate_es256_key("ephemeral-not-published")
    _, unrelated_jwk = generate_es256_key("ephemeral-published")
    token = make_token(signing_key, kid="ephemeral-not-published")
    verifier, client = make_verifier({"keys": [unrelated_jwk]})

    with pytest.raises(InvalidAccessToken):
        verifier.verify(token)
    assert client.fetch_count == 2


def test_real_es256_verifier_resolves_a_new_kid_after_jwks_key_rotation():
    old_private_key, old_public_jwk = generate_es256_key("ephemeral-before-rotation")
    new_private_key, new_public_jwk = generate_es256_key("ephemeral-after-rotation")
    old_user_id = uuid4()
    old_token = make_token(
        old_private_key,
        kid="ephemeral-before-rotation",
        sub=str(old_user_id),
    )
    new_token = make_token(new_private_key, kid="ephemeral-after-rotation")
    client = InMemoryJWKSClient({"keys": [old_public_jwk]})
    verifier, _ = make_verifier({}, resolver=client)

    verifier.verify(old_token)
    client.jwks = {"keys": [old_public_jwk, new_public_jwk]}
    verifier.verify(new_token)

    assert verifier.verify(old_token).supabase_user_id == old_user_id
    assert client.fetch_count == 2
