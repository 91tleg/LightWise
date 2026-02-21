import boto3
from decimal import Decimal
from libs.config import settings
from domain.telemetry.models import TelemetryPayload
from domain.telemetry.health import HealthStatus
from libs.logging import logger

_DYNAMODB = boto3.resource("dynamodb", region_name=settings.AWS_REGION)

class DeviceStateRepo:
    def __init__(self):
        self.table = _DYNAMODB.Table(settings.DDB_TABLE_DEVICES)

    def update_state(self, telemetry: TelemetryPayload, health: HealthStatus) -> None:
        """
        Updates the 'Digital Twin' in DynamoDB with only essential state data.
        """
        try:
            # Note: DynamoDB requires Decimals for floats
            self.table.update_item(
                Key={
                    "tenant_id": telemetry.tenant_id,
                    "device_id": telemetry.device_id
                },
                UpdateExpression=(
                    "SET last_lux = :l, "
                    "current_light_level = :lvl, "
                    "health_status = :h, "
                    "is_active = :a, "
                    "last_seen = :t"
                ),
                ExpressionAttributeValues={
                    ":l": Decimal(str(telemetry.lux)),
                    ":lvl": telemetry.light_level,
                    ":h": health.value,
                    ":a": True, # If we just got telemetry, it's active
                    ":t": telemetry.timestamp.isoformat()
                }
            )
        except Exception as e:
            # Log the error but don't necessarily crash the whole pipeline 
            # if historical data (Timestream) was saved successfully.
            logger.error(f"State update failed: {e}")


from functools import lru_cache

@lru_cache(maxsize=1)
def get_device_state_repository() -> DeviceStateRepo:
    return DeviceStateRepo(table_name=settings.DDB_TABLE_DEVICES)
