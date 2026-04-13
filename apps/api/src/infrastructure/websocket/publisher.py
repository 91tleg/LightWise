import json
from functools import lru_cache
from typing import Optional

import boto3
from botocore.client import BaseClient
from botocore.exceptions import ClientError

from domain.websocket.models import WebSocketConnection
from infrastructure.persistence.dynamo.websocket_connection_repo import (
    get_websocket_connection_repo, WebSocketConnectionRepo
)
from libs.logging import logger


@lru_cache(maxsize=1)
def get_apigateway_client() -> boto3.client:
    """
    Return a cached API Gateway Management client.
    Reused for warm Lambda invocations.
    """
    from libs.config import settings

    endpoint = settings.WS_MANAGEMENT_URL
    return boto3.client(
        "apigatewaymanagementapi",
        endpoint_url=endpoint,
        region_name=settings.AWS_REGION,
    )


class WebSocketPublisher:
    """
    Sends telemetry updates to active WebSocket clients.
    """

    def __init__(
        self,
        repo: Optional[WebSocketConnectionRepo] = None,
        client: Optional[BaseClient] = None,
    ):
        self.repo = repo or get_websocket_connection_repo()
        self.client = client or get_apigateway_client()

    def _push(self, connection_id: str, data: dict) -> None:
        """Sends a single JSON payload to a specific connection."""
        try:
            self.client.post_to_connection(
                ConnectionId=connection_id,
                Data=json.dumps(data)
            )
        except ClientError as e:
            error_code = e.response.get("Error", {}).get("Code")
            if error_code == "GoneException":
                logger.info(
                    f"Connection {connection_id} is gone. Cleaning up."
                )
                try:
                    self.repo.delete(connection_id)
                except Exception as err:
                    logger.error(
                        f"Failed to delete connection {connection_id}: {err}"
                    )
            else:
                logger.error(
                    f"Failed to push to WS {connection_id}: {e}"
                )

    def broadcast(
        self,
        connections: list[WebSocketConnection],
        data: dict
    ) -> None:
        """
        Sends the same payload to multiple active connections.
        Automatically skips and cleans up disconnected clients.
        """
        logger.info(f"Broadcasting to {len(connections)} connections")
        for conn in connections:
            logger.info(f"Pushing to {conn.connection_id}")
            self._push(conn.connection_id, data)


@lru_cache(maxsize=1)
def get_websocket_publisher() -> WebSocketPublisher:
    return WebSocketPublisher()
