"""
WebSocket $disconnect Lambda handler.

Trigger: API Gateway WebSocket $disconnect route.

Always returns 200 - API Gateway ignores the response for $disconnect
but a non-2xx may cause retries on some configurations. The connection
is already gone by the time this handler runs so cleanup failure is
logged but never surfaced to the client.
"""

from __future__ import annotations
from functools import lru_cache

from application.websocket.disconnect import DisconnectWebSocket
from infrastructure.persistence.dynamo.websocket_connection_repo import (
    get_websocket_connection_repo,
)
from libs.logging import logger


@lru_cache(maxsize=1)
def _use_case() -> DisconnectWebSocket:
    return DisconnectWebSocket(
        repo=get_websocket_connection_repo()
    )


def handler(event: dict, context: object) -> dict:
    connection_id = event["requestContext"]["connectionId"]

    try:
        _use_case().execute(connection_id)
        logger.info(
            "WebSocket disconnected",
            extra={"connection_id": connection_id},
        )
    except Exception:
        logger.exception(
            "WebSocket disconnect cleanup failed",
            extra={"connection_id": connection_id},
        )

    return {"statusCode": 200}
