from typing import List
from functools import lru_cache

import boto3

from domain.websocket.models import WebSocketConnection
from libs.config import settings


_DYNAMODB = boto3.resource("dynamodb", region_name=settings.AWS_REGION)


class WebSocketConnectionRepo:
    """
    Repository for managing active WebSocket connections in DynamoDB.
    Uses a GSI to allow querying by StreetlightId.
    """
    def __init__(self, table_name: str):
        self._table = _DYNAMODB.Table(table_name)

    def get_connections_by_streetlight(
        self,
        streetlight_id: str,
        tenant_id: str
    ) -> List[WebSocketConnection]:
        """
        Queries the GSI (StreetlightIndex) to find all users currently
        subscribed to updates for a specific light.
        """
        response = self._table.query(
            IndexName="StreetlightIndex",
            KeyConditionExpression="streetlight_id = :sl AND tenant_id = :t",
            ExpressionAttributeValues={
                ":sl": streetlight_id,
                ":t": tenant_id,
            }
        )

        return [
            WebSocketConnection(
                tenant_id=item["tenant_id"],
                user_id=item["user_id"],
                connection_id=item["connection_id"],
                connected_at=item["connected_at"]
            )
            for item in response.get("Items", [])
        ]

    def save(
        self,
        connection: WebSocketConnection,
        streetlight_id: str
    ) -> None:
        """
        Saves or updates a connection session with a 2-hour TTL.
        """
        self._table.put_item(
            Item={
                "connection_id": connection.connection_id,
                "tenant_id": connection.tenant_id,
                "user_id": connection.user_id,
                "streetlight_id": streetlight_id,
                "connected_at": connection.connected_at,
                "ttl": int(connection.connected_at.timestamp() + 7200)
            }
        )

    def delete(self, connection_id: str) -> None:
        """
        Cleans up a session when a user disconnects.
        """
        self._table.delete_item(Key={"connection_id": connection_id})


@lru_cache(maxsize=1)
def get_websocket_connection_repository() -> WebSocketConnectionRepo:
    return WebSocketConnectionRepo(
               table_name=settings.DDB_TABLE_WS_CONNECTIONS
           )
