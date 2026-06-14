from __future__ import annotations
from dataclasses import dataclass

from libs.config import settings


@dataclass(frozen=True)
class CognitoConfig:
    region: str
    user_pool_id: str
    client_id: str
    domain: str
    redirect_uri: str

    @property
    def issuer(self) -> str:
        return (
            f"https://cognito-idp.{self.region}.amazonaws.com/"
            f"{self.user_pool_id}"
        )

    @property
    def jwks_url(self) -> str:
        return f"{self.issuer}/.well-known/jwks.json"

    @property
    def token_url(self) -> str:
        return f"https://{self.domain}/oauth2/token"


def get_cognito_config() -> CognitoConfig:
    return CognitoConfig(
        region=settings.AWS_REGION,
        user_pool_id=settings.COGNITO_USER_POOL_ID,
        client_id=settings.COGNITO_CLIENT_ID,
        domain=settings.COGNITO_DOMAIN,
        redirect_uri=settings.COGNITO_REDIRECT_URI,
    )
