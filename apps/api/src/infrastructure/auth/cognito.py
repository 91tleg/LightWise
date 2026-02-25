import json
import urllib.request
from dataclasses import dataclass
from functools import lru_cache

import jwt  # PyJWT
from jwt.algorithms import RSAAlgorithm

from domain.error import AuthError


@dataclass(frozen=True)
class CognitoConfig:
    region: str
    user_pool_id: str
    client_id: str

    @property
    def issuer(self) -> str:
        return (
            f"https://cognito-idp.{self.region}.amazonaws.com/"
            f"{self.user_pool_id}"
        )

    @property
    def jwks_url(self) -> str:
        return f"{self.issuer}/.well-known/jwks.json"


@dataclass(frozen=True)
class VerifiedClaims:
    sub: str
    tenant_id: str
    email: str | None
    groups: list[str]
    client_id: str


class CognitoVerifier:
    def __init__(self, config: CognitoConfig) -> None:
        self._config = config

    @lru_cache(maxsize=1)
    def _get_jwks(self) -> dict:
        """
        Fetch and cache JWKS from Cognito.
        Cached for the lifetime of the Lambda container.
        """
        with urllib.request.urlopen(
            self._config.jwks_url,
            timeout=5
        ) as response:
            return json.loads(response.read())

    def _get_public_key(self, kid: str):
        jwks = self._get_jwks()
        for key in jwks.get("keys", []):
            if key["kid"] == kid:
                return RSAAlgorithm.from_jwk(json.dumps(key))
        raise AuthError(f"No matching key found for kid: {kid}")

    def verify(self, token: str) -> VerifiedClaims:
        """
        Verify a Cognito JWT and return typed claims.
        Raises AuthError on any failure.
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

        # Validate token use
        token_use = claims.get("token_use")
        if token_use not in ("access", "id"):
            raise AuthError(f"Unexpected token_use: {token_use}")

        # Validate client
        if claims.get("client_id") != self._config.client_id:
            raise AuthError("Token client_id mismatch")

        tenant_id = claims.get("custom:tenant_id")
        if not tenant_id:
            raise AuthError("Token missing custom:tenant_id claim")

        return VerifiedClaims(
            sub=claims["sub"],
            tenant_id=tenant_id,
            email=claims.get("email"),
            groups=claims.get("cognito:groups", []),
            client_id=claims["client_id"],
        )


def extract_bearer_token(authorization_header: str | None) -> str:
    """Pull the raw JWT out of an Authorization: Bearer <token> header."""
    if not authorization_header:
        raise AuthError("Missing Authorization header")
    parts = authorization_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise AuthError("Authorization header must be 'Bearer <token>'")
    return parts[1]
