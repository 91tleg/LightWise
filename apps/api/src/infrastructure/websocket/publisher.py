import json
from functools import lru_cache

import boto3
from botocore.exceptions import ClientError

from domain.websocket.models import WebSocketConnection
from infrastructure.persistence.dynamo.websocket_connection_repo import (
    get_websocket_connection_repository,
    WebSocketConnectionRepo
)
from libs.config import settings
from libs.logging import logger


@lru_cache(maxsize=1)
def get_apigateway_client() -> boto3.client:
    """
    Return a cached API Gateway Management client.
    Reused for warm Lambda invocations.
    """
    return boto3.client(
        "apigatewaymanagementapi",
        endpoint_url=settings.ws_management_url,
        region_name=settings.AWS_REGION,
    )


class SensorEventPublisher:
    """
    Sends telemetry updates to active WebSocket clients.
    Optimized for Lambda warm start by reusing both
    the API Gateway client and the WebSocket repository.
    """

    def __init__(
        self,
        repo: WebSocketConnectionRepo | None = None,
        client: boto3.client | None = None,
    ):
        self.repo = repo or get_websocket_connection_repository()
        self.client = client or get_apigateway_client()

    def push(self, connection_id: str, data: dict) -> None:
        """Sends a single JSON payload to a specific connection."""
        try:
            self.client.post_to_connection(
                ConnectionId=connection_id,
                Data=json.dumps(data)
            )
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code")
            if error_code == "GoneException":
                logger.info(f"Connection {connection_id} is gone. Cleaning up.")
                try:
                    self.repo.delete(connection_id)
                except Exception as repo_err:
                    logger.error(f"Failed to delete connection {connection_id}: {repo_err}")
            else:
                logger.error(f"Failed to push to WS {connection_id}: {e}")

    def broadcast(self, connections: list[WebSocketConnection], data: dict) -> None:
        """
        Sends the same payload to multiple active connections.
        Automatically skips and cleans up disconnected clients.
        """
        for conn in connections:
            self.push(conn.connection_id, data)
