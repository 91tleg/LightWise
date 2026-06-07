"""
WebSocket $connect Lambda handler.

Trigger: API Gateway WebSocket $connect route.

Responsibilities:
  - Resolve identity from the connection event
  - Persist the connection record
  - Return 200 to allow the connection or 401/500 to reject it

Returning a non-2xx status from $connect causes API Gateway to
reject the WebSocket handshake immediately.
"""

from __future__ import annotations
from functools import lru_cache

from application.websocket.connect import ConnectWebSocket
from domain.errors import AuthError
from infrastructure.auth.identity import extract_websocket_identity
from libs.logging import logger


@lru_cache(maxsize=1)
def _use_case() -> ConnectWebSocket:
    return ConnectWebSocket()


def handler(event: dict, context: object) -> dict:
    connection_id = event["requestContext"]["connectionId"]

    try:
        tenant_id, user_id = extract_websocket_identity(event)
        connection = _use_case().execute(
            connection_id=connection_id,
            tenant_id=tenant_id,
            user_id=user_id,
        )
    except AuthError as exc:
        logger.warning(
            "WebSocket connect rejected - auth failed",
            extra={
                "connection_id": connection_id,
                "error": str(exc),
            },
        )
        return {"statusCode": 401}
    except Exception:
        logger.exception(
            "WebSocket connect failed",
            extra={"connection_id": connection_id},
        )
        return {"statusCode": 500}

    logger.info(
        "WebSocket connected",
        extra={
            "connection_id": connection.connection_id,
            "tenant_id": connection.tenant_id,
            "user_id": connection.user_id,
        },
    )

    selected_protocol = (
        event.get("requestContext", {})
        .get("authorizer", {})
        .get("selected_protocol", "Bearer")
    )

    return {
        "statusCode": 200,
        "headers": {
            "Sec-WebSocket-Protocol": selected_protocol,
        },
    }
