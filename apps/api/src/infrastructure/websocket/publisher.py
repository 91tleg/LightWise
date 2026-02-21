import json
import boto3
from botocore.exceptions import ClientError
from infrastructure.persistence.dynamo.websocket_connection_repo import delete_connection
from libs.config import settings
from libs.logging import logger


class SensorEventPublisher:
    """Sends telemetry updates to active WebSocket clients."""

    def __init__(self):
        # The SDK requires HTTPS for the 'endpoint_url'
        self.client = boto3.client(
            "apigatewaymanagementapi",
            endpoint_url=settings.ws_management_url,
            region_name=settings.AWS_REGION
        )

    def push(self, connection_id: str, data: dict) -> None:
        """Sends a single JSON payload to a specific connection."""
        try:
            self.client.post_to_connection(
                ConnectionId=connection_id,
                Data=json.dumps(data)
            )
        except ClientError as e:
            # 410 Gone means the user disconnected; we should probably 
            # delete that stale connection from our DynamoDB table here.
            if e.response["Error"]["Code"] == "GoneException":
                logger.info(f"Connection {connection_id} is gone. Cleaning up.")
                delete_connection(connection_id) 
            else:
                logger.error(f"Failed to push to WS: {e}")
