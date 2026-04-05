"""
ConnectWebSocket application use case.

Handles the WebSocket $connect lifecycle -
resolves identity, creates the connection record, and persists it.
"""

from __future__ import annotations
from datetime import datetime, timezone
from typing import Protocol

from domain.websocket.models import WebSocketConnection


class IdentityResolver(Protocol):
    def resolve(self, event: dict) -> tuple[str, str]: ...


class WebSocketConnectionRepository(Protocol):
    def save(self, connection: WebSocketConnection) -> None: ...


class ConnectWebSocket:
    def __init__(
        self,
        identity_resolver: IdentityResolver,
        repo: WebSocketConnectionRepository,
    ) -> None:
        self._identity_resolver = identity_resolver
        self._repo = repo

    def execute(self, event: dict) -> WebSocketConnection:
        tenant_id, user_id = self._identity_resolver.resolve(event)

        connection = WebSocketConnection(
            tenant_id=tenant_id,
            user_id=user_id,
            connection_id=event["requestContext"]["connectionId"],
            connected_at=datetime.now(timezone.utc),
        )

        self._repo.save(connection)
        return connection
