"""
WebSocket Lambda authorizer.

Trigger: API Gateway WebSocket $connect route authorizer.

Verifies the Bearer token passed as a query string parameter on the
WebSocket handshake URL.
WebSocket connections cannot send Authorization headers during the
handshake - the token must be passed as a query parameter instead.

On success returns an IAM Allow policy and injects tenant_id and
user_id into the authorizer context so downstream handlers can extract
them from requestContext.authorizer without re-verifying the token.

On failure raises Exception("Unauthorized") - API Gateway requires a
raised exception to reject the connection.
"""

from __future__ import annotations
from functools import lru_cache

from infrastructure.auth.cognito_config import CognitoConfig
from infrastructure.auth.cognito_verifier import CognitoVerifier
from infrastructure.auth.iam import allow_policy
from infrastructure.auth.token import extract_bearer_token
from libs.config import settings
from libs.logging import logger


@lru_cache(maxsize=1)
def _verifier() -> CognitoVerifier:
    return CognitoVerifier(
        CognitoConfig(
            region=settings.AWS_REGION,
            user_pool_id=settings.COGNITO_USER_POOL_ID,
            client_id=settings.COGNITO_CLIENT_ID,
        )
    )


def handler(event: dict, context: object) -> dict:
    token = (event.get("queryStringParameters") or {}).get("token")

    if not token:
        logger.warning(
            "WebSocket auth rejected - no token in query string",
            extra={"method_arn": event.get("methodArn")},
        )
        raise Exception("Unauthorized")

    try:
        bearer = extract_bearer_token(token)
        claims = _verifier().verify(bearer)
    except Exception:
        logger.warning(
            "WebSocket auth rejected - token verification failed",
            extra={"method_arn": event.get("methodArn")},
        )
        raise Exception("Unauthorized")

    logger.info(
        "WebSocket authorized",
        extra={
            "tenant_id": claims.tenant_id,
            "sub": claims.sub,
        },
    )

    return allow_policy(
        principal_id=claims.sub,
        method_arn=event["methodArn"],
        context={
            "tenant_id": claims.tenant_id,
            "user_id": claims.sub,
        },
    )
