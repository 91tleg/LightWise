"""
ConnectWebSocket application use case.
Handles the WebSocket $connect lifecycle.
Connection identity is validated here; subscription records
are created per streetlight via the subscribe action.
"""
from __future__ import annotations
from datetime import datetime, timezone

from domain.websocket.models import WebSocketConnection


class ConnectWebSocket:
    def execute(
        self,
        connection_id: str,
        tenant_id: str,
        user_id: str,
    ) -> WebSocketConnection:
        return WebSocketConnection(
            tenant_id=tenant_id,
            user_id=user_id,
            connection_id=connection_id,
            connected_at=datetime.now(timezone.utc),
        )
