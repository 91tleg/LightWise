from datetime import datetime, timezone
import json

from domain.websocket.models import WebSocketConnection
from domain.error import AuthError
from infrastructure.auth.identity import resolve_identity
from infrastructure.persistence.dynamo.websocket_connection_repo import (
    get_websocket_connection_repository,
)


class WebSocketSubscribeService:
    """Handles subscription to streetlight updates."""

    def __init__(self):
        self.repo = get_websocket_connection_repository()

    def subscribe(self, event: dict) -> WebSocketConnection:
        connection_id = event["requestContext"]["connectionId"]
        body = json.loads(event.get("body", "{}"))
        streetlight_id = body.get("streetlight_id")

        if not streetlight_id:
            raise ValueError("streetlight_id is required")

        try:
            tenant_id, user_id = resolve_identity(event)
        except Exception as e:
            raise AuthError(
                f"WebSocket subscription auth failed: {e}"
            ) from e

        connection = WebSocketConnection(
            tenant_id=tenant_id,
            user_id=user_id,
            connection_id=connection_id,
            connected_at=datetime.now(timezone.utc),
        )

        self.repo.save_subscription(
            connection=connection,
            streetlight_id=streetlight_id
        )

        return connection
