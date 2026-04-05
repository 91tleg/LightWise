"""
SubscribeWebSocket application use case.

Handles WebSocket subscription to streetlight updates.
Resolves identity, validates the request body, and persists
the subscription against the connection record.
"""

from __future__ import annotations
import json
from datetime import datetime, timezone
from typing import Protocol

from domain.error import AuthError
from domain.websocket.models import WebSocketConnection


class IdentityResolver(Protocol):
    def resolve(self, event: dict) -> tuple[str, str]: ...


class WebSocketConnectionRepo(Protocol):
    def save_subscription(
        self,
        connection: WebSocketConnection,
        streetlight_id: str,
    ) -> None: ...


class SubscribeWebSocket:

    def __init__(
        self,
        identity_resolver: IdentityResolver,
        repo: WebSocketConnectionRepo,
    ) -> None:
        self._identity_resolver = identity_resolver
        self._repo = repo

    def execute(
        self, event: dict, now: datetime | None = None
    ) -> WebSocketConnection:
        """
        Process a WebSocket subscription request.
        """
        connection_id = event["requestContext"]["connectionId"]
        streetlight_id = self._parse_streetlight_id(event)

        try:
            tenant_id, user_id = self._identity_resolver.resolve(event)
        except AuthError:
            raise
        except Exception as exc:
            raise AuthError(
                f"WebSocket subscription auth failed: {exc}"
            ) from exc

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

    @staticmethod
    def _parse_streetlight_id(event: dict) -> str:
        try:
            body = json.loads(event.get("body") or "{}")
        except json.JSONDecodeError as exc:
            raise ValueError("Request body is not valid JSON") from exc

        streetlight_id = body.get("streetlight_id")
        if not streetlight_id:
            raise ValueError("streetlight_id is required")

        return streetlight_id
