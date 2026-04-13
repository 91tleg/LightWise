"""
ConnectWebSocket application use case.
Handles the WebSocket $connect lifecycle —
creates the connection record and persists it.
"""
from __future__ import annotations
from datetime import datetime, timezone
from typing import Protocol

from domain.websocket.models import WebSocketConnection


class WebSocketConnectionRepo(Protocol):
    def save(self, connection: WebSocketConnection) -> None: ...


class ConnectWebSocket:
    def __init__(self, repo: WebSocketConnectionRepo) -> None:
        self._repo = repo

    def execute(
        self,
        connection_id: str,
        tenant_id: str,
        user_id: str,
    ) -> WebSocketConnection:
        connection = WebSocketConnection(
            tenant_id=tenant_id,
            user_id=user_id,
            connection_id=connection_id,
            connected_at=datetime.now(timezone.utc),
        )
        self._repo.save(connection)
        return connection
