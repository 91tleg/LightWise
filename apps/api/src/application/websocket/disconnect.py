"""
DisconnectWebSocket application use case.

Handles the WebSocket $disconnect lifecycle -
removes the connection record from DB.
"""

from __future__ import annotations
from typing import Protocol


class WebSocketConnectionRepo(Protocol):
    def delete(self, connection_id: str) -> None: ...


class DisconnectWebSocket:
    def __init__(self, repo: WebSocketConnectionRepo) -> None:
        self._repo = repo

    def execute(self, connection_id: str) -> None:
        self._repo.delete(connection_id)
