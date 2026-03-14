from __future__ import annotations
from dataclasses import dataclass


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
