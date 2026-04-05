"""
WebSocket subscribe Lambda handler.

Trigger: API Gateway WebSocket message route (action: subscribe).

Responsibilities:
  - Parse streetlight_id from the message body
  - Resolve identity from the connection context
  - Persist the subscription
  - Return 200 on success, 400/401/500 on failure
"""

from __future__ import annotations
from functools import lru_cache

from application.websocket.subscribe import SubscribeWebSocket
from domain.error import AuthError
from infrastructure.auth.identity import IdentityResolver
from infrastructure.persistence.dynamo.websocket_connection_repo import (
    get_websocket_connection_repo,
)
from libs.logging import logger


@lru_cache(maxsize=1)
def _use_case() -> SubscribeWebSocket:
    return SubscribeWebSocket(
        identity_resolver=IdentityResolver(),
        repo=get_websocket_connection_repo()
    )


def handler(event: dict, context: object) -> dict:
    connection_id = event["requestContext"]["connectionId"]

    try:
        connection = _use_case().execute(event)
    except ValueError as exc:
        logger.warning(
            "WebSocket subscribe rejected - invalid request",
            extra={
                "connection_id": connection_id,
                "error": str(exc),
            },
        )
        return {"statusCode": 400, "body": str(exc)}
    except AuthError as exc:
        logger.warning(
            "WebSocket subscribe rejected - auth failed",
            extra={
                "connection_id": connection_id,
                "error": str(exc),
            },
        )
        return {"statusCode": 401}
    except Exception:
        logger.exception(
            "WebSocket subscribe failed",
            extra={"connection_id": connection_id},
        )
        return {"statusCode": 500}

    logger.info(
        "WebSocket subscribed",
        extra={
            "connection_id": connection.connection_id,
            "tenant_id": connection.tenant_id,
            "user_id": connection.user_id,
        },
    )
    return {"statusCode": 200, "body": "subscribed"}
