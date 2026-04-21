from __future__ import annotations
import json
import urllib.request
from dataclasses import dataclass
from functools import cached_property

import jwt
from jwt.algorithms import RSAAlgorithm

from domain.errors import AuthError
from infrastructure.auth.cognito_config import CognitoConfig
from infrastructure.auth.identity import parse_groups


@dataclass(frozen=True)
class VerifiedClaims:
    sub: str
    tenant_id: str
    email: str | None
    groups: frozenset[str]
    client_id: str
    given_name: str
    family_name: str


class CognitoVerifier:
    def __init__(self, config: CognitoConfig) -> None:
        self._config = config

    @cached_property
    def _jwks(self) -> dict:
        """
        Fetch and cache JWKS from Cognito.
        Cached for the lifetime of the Lambda container via cached_property.
        lru_cache is intentionally avoided on instance methods — it holds
        a strong reference to self and prevents GC.
        """
        with urllib.request.urlopen(self._config.jwks_url, timeout=5) as r:
            return json.loads(r.read())

    def _get_public_key(self, kid: str):
        for key in self._jwks.get("keys", []):
            if key["kid"] == kid:
                return RSAAlgorithm.from_jwk(json.dumps(key))
        raise AuthError(f"No matching key found for kid: {kid}")

    def verify(self, token: str) -> VerifiedClaims:
        """
        Verify a Cognito JWT and return typed claims.
        Raises AuthError on any failure.

        Note: verify_aud is disabled because Cognito access tokens
        populate `client_id` while ID tokens populate `aud`. The client
        identifier is validated manually after token_use is known.
        """
        try:
            header = jwt.get_unverified_header(token)
        except jwt.DecodeError as e:
            raise AuthError("Invalid token header") from e

        kid = header.get("kid")
        if not kid:
            raise AuthError("Token header missing kid")

        try:
            public_key = self._get_public_key(kid)
        except AuthError:
            raise
        except Exception as e:
            raise AuthError("Failed to retrieve public key") from e

        try:
            claims = jwt.decode(
                token,
                public_key,
                algorithms=["RS256"],
                issuer=self._config.issuer,
                options={
                    "verify_exp": True,
                    "verify_iss": True,
                    "verify_aud": False,
                },
            )
        except jwt.ExpiredSignatureError as e:
            raise AuthError("Token has expired") from e
        except jwt.InvalidIssuerError as e:
            raise AuthError("Invalid token issuer") from e
        except jwt.DecodeError as e:
            raise AuthError("Token decode failed") from e

        token_use = claims.get("token_use")
        if token_use not in ("access", "id"):
            raise AuthError(f"Unexpected token_use: {token_use}")

        client_id_claim = "aud" if token_use == "id" else "client_id"
        client_id = claims.get(client_id_claim)
        if not client_id:
            raise AuthError(f"Token missing {client_id_claim} claim")
        if client_id != self._config.client_id:
            raise AuthError("Token client_id mismatch")

        tenant_id = claims.get("custom:tenant_id")
        if not tenant_id:
            raise AuthError("Token missing custom:tenant_id claim")

        groups = parse_groups(claims.get("cognito:groups", []))

        return VerifiedClaims(
            sub=claims["sub"],
            tenant_id=tenant_id,
            email=claims.get("email"),
            groups=groups,
            client_id=client_id,
            given_name=claims.get("given_name") or "",
            family_name=claims.get("family_name") or "",
        )
