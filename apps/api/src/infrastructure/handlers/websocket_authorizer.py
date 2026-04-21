from __future__ import annotations
from functools import lru_cache

from infrastructure.auth.cognito_config import CognitoConfig
from infrastructure.auth.cognito_verifier import CognitoVerifier
from domain.errors import AuthError
from infrastructure.auth.iam import allow_policy
from infrastructure.auth.token import extract_websocket_auth
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
    auth = extract_websocket_auth(event)
    if not auth:
        logger.warning(
            "WebSocket auth rejected - no token in Sec-WebSocket-Protocol",
            extra={"method_arn": event.get("methodArn")},
        )
        raise Exception("Unauthorized")

    try:
        claims = _verifier().verify(auth.token)
    except AuthError as exc:
        logger.warning(
            "WebSocket auth rejected - token verification failed",
            extra={
                "method_arn": event.get("methodArn"),
                "auth_error": str(exc),
            },
        )
        raise Exception("Unauthorized")
    except Exception as exc:
        logger.exception(
            "WebSocket auth rejected - verifier failure",
            extra={
                "method_arn": event.get("methodArn"),
                "auth_error": str(exc),
            },
        )
        raise Exception("Unauthorized")

    logger.info(
        "WebSocket authorized",
        extra={"tenant_id": claims.tenant_id, "sub": claims.sub},
    )
    return allow_policy(
        principal_id=claims.sub,
        method_arn=event["methodArn"],
        context={
            "tenant_id": claims.tenant_id,
            "user_id": claims.sub,
            "selected_protocol": auth.selected_protocol,
        },
    )
