from datetime import datetime, timezone

from domain.websocket.models import WebSocketConnection
from infrastructure.auth.identity import resolve_identity
from infrastructure.persistence.dynamo.websocket_connection_repo import (
    get_websocket_connection_repository,
)


class WebSocketConnectService:
    """Handles webSocket connect logic."""

    def __init__(self):
        self.repo = get_websocket_connection_repository()

    def connect(self, event: dict) -> WebSocketConnection:
        tenant_id, user_id = resolve_identity(event)

        connection = WebSocketConnection(
            tenant_id=tenant_id,
            user_id=user_id,
            connection_id=event["requestContext"]["connectionId"],
            connected_at=datetime.now(timezone.utc),
        )

        # Persist connection
        self.repo.save(connection)

        return connection
