from decimal import Decimal
from functools import lru_cache

import boto3
from boto3.dynamodb.conditions import Key

from domain.telemetry.models import TelemetryPayload
from domain.streetlight.health import HealthStatus
from domain.streetlight.models import Streetlight
from libs.config import settings
from libs.logging import logger


_DYNAMODB = boto3.resource(
    "dynamodb",
    region_name=settings.AWS_REGION,
    endpoint_url=settings.DYNAMO_ENDPOINT or None,
)


class StreetlightsRepo:
    def __init__(self, table_name: str) -> None:
        self.table = _DYNAMODB.Table(table_name)

    SUMMARY_FIELDS = (
        "streetlight_id, tenant_id, health_status, last_seen, "
        "motion_detected, ambient_primary_ok, ambient_secondary_ok, "
        "th_ok, motion_primary_ok, motion_secondary_ok"
    )

    def update(
        self,
        telemetry: TelemetryPayload,
        health: HealthStatus,
    ) -> None:
        try:
            self.table.update_item(
                Key={
                    "tenant_id": telemetry.tenant_id,
                    "streetlight_id": telemetry.streetlight_id,
                },
                UpdateExpression=(
                    "SET last_lux = :l, "
                    "current_light_level = :lvl, "
                    "health_status = :h, "
                    "is_active = :a, "
                    "last_seen = :t, "
                    "motion_detected = :m, "
                    "ambient_primary_ok = :ap, "
                    "ambient_secondary_ok = :as_, "
                    "th_ok = :th, "
                    "motion_primary_ok = :cp, "
                    "motion_secondary_ok = :cs_"
                ),
                ExpressionAttributeValues={
                    ":l": Decimal(str(telemetry.lux)),
                    ":lvl": telemetry.light_level,
                    ":h": health.value,
                    ":a": True,
                    ":t": telemetry.timestamp.isoformat(),
                    ":m": telemetry.motion,
                    ":ap": telemetry.ambient_primary_ok,
                    ":as_": telemetry.ambient_secondary_ok,
                    ":th": telemetry.th_ok,
                    ":cp": telemetry.motion_primary_ok,
                    ":cs_": telemetry.motion_secondary_ok,
                },
            )
        except Exception as e:
            logger.error(
                f"Update failed for {telemetry.streetlight_id}: {e}"
            )

    def list_by_tenant(self, tenant_id: str) -> list[Streetlight]:
        try:
            response = self.table.query(
                KeyConditionExpression=Key("tenant_id").eq(tenant_id),
                ProjectionExpression=self.SUMMARY_FIELDS,
            )
            return [
                Streetlight(
                    streetlight_id=item["streetlight_id"],
                    tenant_id=item["tenant_id"],
                    health=HealthStatus(
                        item.get("health_status", HealthStatus.OK.value)
                    ),
                    last_seen=item.get("last_seen"),
                    motion_detected=item.get("motion_detected"),
                    ambient_primary_ok=item.get("ambient_primary_ok"),
                    ambient_secondary_ok=item.get("ambient_secondary_ok"),
                    th_ok=item.get("th_ok"),
                    motion_primary_ok=item.get("motion_primary_ok"),
                    motion_secondary_ok=item.get("motion_secondary_ok"),
                )
                for item in response.get("Items", [])
            ]
        except Exception as e:
            logger.error(
                f"list_by_tenant failed for {tenant_id}: {e}"
            )
            return []

    def get_tenant_id(self, streetlight_id: str) -> str:
        result = self.table.query(
            IndexName="StreetlightIndex",
            KeyConditionExpression=Key("streetlight_id").eq(streetlight_id),
            ProjectionExpression="tenant_id",
            Limit=1,
        )
        items = result.get("Items", [])
        if not items:
            raise ValueError(
                f"No tenant found for streetlight {streetlight_id}"
            )
        return items[0]["tenant_id"]


@lru_cache(maxsize=1)
def get_streetlights_repository() -> StreetlightsRepo:
    return StreetlightsRepo(
        table_name=settings.DDB_TABLE_STREETLIGHTS
    )
