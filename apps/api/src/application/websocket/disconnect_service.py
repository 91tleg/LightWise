from infrastructure.persistence.dynamo.websocket_connection_repo import (
    get_websocket_connection_repository,
)


class WebSocketDisconnectService:
    """Handles WebSocket disconnect cleanup."""

    def __init__(self):
        self.repo = get_websocket_connection_repository()

    def disconnect(self, connection_id: str) -> None:
        self.repo.delete(connection_id)
