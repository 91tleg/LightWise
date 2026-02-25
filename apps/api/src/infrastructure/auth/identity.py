from .cognito import extract_bearer_token, CognitoVerifier, CognitoConfig
from libs.config import settings


def resolve_identity(event: dict) -> tuple[str, str]:
    """Resolve tenant_id and user_id from the request."""

    if not settings.AUTH_ENABLED:
        return "public", "anonymous"

    headers = event.get("headers") or {}
    auth_header = headers.get("Authorization") or headers.get("authorization")

    token = extract_bearer_token(auth_header)

    verifier = CognitoVerifier(
        CognitoConfig(
            region=settings.AWS_REGION,
            user_pool_id=settings.COGNITO_USER_POOL_ID,
            client_id=settings.COGNITO_CLIENT_ID,
        )
    )

    claims = verifier.verify(token)

    return claims.tenant_id, claims.sub
