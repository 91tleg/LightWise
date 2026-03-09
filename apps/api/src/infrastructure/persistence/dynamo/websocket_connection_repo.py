from typing import List
from functools import lru_cache
from datetime import datetime

import boto3
from boto3.dynamodb.conditions import Key

from infrastructure.persistence.error import PersistenceError
from domain.websocket.models import WebSocketConnection
from libs.config import settings


_DYNAMODB = boto3.resource(
    "dynamodb",
    region_name=settings.AWS_REGION,
    endpoint_url=settings.DYNAMO_ENDPOINT or None,
)


class WebSocketConnectionRepo:
    """
    Repository for managing active WebSocket connections in DynamoDB.

    Table:
      PK  : connection_id

    GSI (StreetlightIndex):
      PK  : streetlight_id
      SK  : tenant_id
    """

    def __init__(self, table_name: str):
        self._table = _DYNAMODB.Table(table_name)

    def get_connections_for_streetlight(
        self,
        *,
        tenant_id: str,
        streetlight_id: str
    ) -> List[WebSocketConnection]:
        try:
            response = self._table.query(
                IndexName="StreetlightIndex",
                KeyConditionExpression=(
                    Key("streetlight_id").eq(streetlight_id) &
                    Key("tenant_id").eq(tenant_id)
                )
            )

            return [
                WebSocketConnection(
                    tenant_id=item["tenant_id"],
                    user_id=item["user_id"],
                    connection_id=item["connection_id"],
                    connected_at=datetime.fromisoformat(
                        item["connected_at"]
                    ),
                )
                for item in response.get("Items", [])
            ]
        except Exception as e:
            raise PersistenceError(
                f"Error fetching subscriptions for {streetlight_id}"
            ) from e

    def save(
        self,
        connection: WebSocketConnection,
        ttl_seconds: int = 7200
    ) -> None:
        """persist a connection itself."""
        try:
            self._table.put_item(
                Item={
                    "connection_id": connection.connection_id,
                    "tenant_id": connection.tenant_id,
                    "user_id": connection.user_id,
                    "connected_at": connection.connected_at.isoformat(),
                    "ttl": int(
                        connection.connected_at.timestamp() + ttl_seconds
                    ),
                }
            )
        except Exception as e:
            raise PersistenceError(
                "Could not persist WebSocket connection"
            ) from e

    def save_subscription(
        self,
        *,
        connection: WebSocketConnection,
        streetlight_id: str,
        ttl_seconds: int = 7200,
    ) -> None:
        """persist a subscription."""
        try:
            self._table.put_item(
                Item={
                    "connection_id": connection.connection_id,
                    "tenant_id": connection.tenant_id,
                    "user_id": connection.user_id,
                    "streetlight_id": streetlight_id,
                    "connected_at": connection.connected_at.isoformat(),
                    "ttl": int(
                        connection.connected_at.timestamp() + ttl_seconds
                    ),
                }
            )
        except Exception as e:
            raise PersistenceError(
                f"Could not save subscription: {connection.connection_id}"
            ) from e

    def delete(self, connection_id: str) -> None:
        """
        Cleans up a session when a user disconnects.
        """
        try:
            self._table.delete_item(
                Key={"connection_id": connection_id}
            )
        except Exception as e:
            raise PersistenceError(
                f"Could not remove connection: {connection_id}"
            ) from e


@lru_cache(maxsize=1)
def get_websocket_connection_repository() -> WebSocketConnectionRepo:
    return WebSocketConnectionRepo(
        table_name=settings.DDB_TABLE_WS_CONNECTIONS
    )
