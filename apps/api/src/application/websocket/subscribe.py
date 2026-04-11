"""
SubscribeWebSocket application use case.
Handles WebSocket subscription to streetlight updates.
Validates the streetlight_id and persists the subscription
against the connection record.
"""

from __future__ import annotations
from datetime import datetime, timezone
from typing import Protocol

from domain.websocket.models import WebSocketConnection


class WebSocketConnectionRepo(Protocol):
    def save_subscription(
        self,
        connection: WebSocketConnection,
        streetlight_id: str,
    ) -> None: ...


class SubscribeWebSocket:
    def __init__(self, repo: WebSocketConnectionRepo) -> None:
        self._repo = repo

    def execute(
        self,
        connection_id: str,
        tenant_id: str,
        user_id: str,
        streetlight_id: str,
        now: datetime | None = None,
    ) -> WebSocketConnection:
        connection = WebSocketConnection(
            tenant_id=tenant_id,
            user_id=user_id,
            connection_id=connection_id,
            connected_at=now or datetime.now(timezone.utc),
        )
        self._repo.save_subscription(
            connection=connection,
            streetlight_id=streetlight_id,
        )
        return connection
