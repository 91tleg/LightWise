import boto3
from decimal import Decimal
from functools import lru_cache

from domain.telemetry.models import TelemetryPayload
from domain.telemetry.health import HealthStatus
from domain.streetlight.models import StreetlightSummary
from libs.config import settings
from libs.logging import logger


_DYNAMODB = boto3.resource("dynamodb", region_name=settings.AWS_REGION)


class DeviceStateRepo:
    def __init__(self, table_name: str) -> None:
        self.table = _DYNAMODB.Table(table_name)

    def update(
        self,
        telemetry: TelemetryPayload,
        health: HealthStatus
    ) -> None:
        """Updates the digital twin in DynamoDB with latest telemetry."""
        try:
            self.table.update_item(
                Key={
                    "tenant_id": telemetry.tenant_id,
                    "device_id": telemetry.device_id,
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
                    ":a": True,
                    ":t": telemetry.timestamp.isoformat(),
                },
            )
        except Exception as e:
            logger.error(f"State update failed for {telemetry.device_id}: {e}")

    def list_by_tenant(self, tenant_id: str) -> list[StreetlightSummary]:
        """
        Query all devices for a tenant via GSI.
        Requires a GSI with partition key: tenant_id (e.g. 'TenantIndex').
        """
        try:
            response = self.table.query(
                IndexName="TenantIndex",
                KeyConditionExpression="tenant_id = :tid",
                ExpressionAttributeValues={
                    ":tid": tenant_id,
                },
                ProjectionExpression=(
                    "device_id, "
                    "tenant_id, "
                    "health_status, "
                    "last_seen"
                ),
            )

            return [
                StreetlightSummary(
                    device_id=item["device_id"],
                    tenant_id=item["tenant_id"],
                    health=HealthStatus(
                        item.get(
                            "health_status",
                            HealthStatus.OK.value,
                        )
                    ),
                    last_seen=item.get("last_seen"),
                )
                for item in response.get("Items", [])
            ]
        except Exception as e:
            logger.error(f"list_by_tenant failed for {tenant_id}: {e}")
            return []


@lru_cache(maxsize=1)
def get_device_state_repository() -> DeviceStateRepo:
    return DeviceStateRepo(table_name=settings.DDB_TABLE_DEVICES)
