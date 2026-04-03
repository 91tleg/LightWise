from decimal import Decimal
from functools import lru_cache
from typing import Optional

from boto3.dynamodb.conditions import Key

from infrastructure.persistence.dynamo.client import get_dynamodb_resource
from infrastructure.persistence.error import PersistenceError
from domain.streetlight.events import TelemetryReport
from domain.streetlight.health import HealthStatus
from domain.streetlight.models import Streetlight


class StreetlightsRepo:
    def __init__(self, table_name: str) -> None:
        self._db = get_dynamodb_resource()
        self._table = self._db.Table(table_name)

    SUMMARY_FIELDS = (
        "streetlight_id, tenant_id, health_status, last_seen, "
        "motion_detected, ambient_primary_ok, ambient_secondary_ok, "
        "th_ok, motion_primary_ok, motion_secondary_ok"
    )

    def update(
        self,
        telemetry: TelemetryReport,
        health: HealthStatus,
    ) -> None:
        try:
            self._table.update_item(
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
            raise PersistenceError(
                f"Database update failed for {telemetry.streetlight_id}"
            ) from e

    def list_by_tenant(self, tenant_id: str) -> list[Streetlight]:
        try:
            response = self._table.query(
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
            raise PersistenceError(
                f"Could not retrieve streetlights for tenant {tenant_id}"
            ) from e

    def get_tenant_id(self, streetlight_id: str) -> str:
        try:
            result = self._table.query(
                IndexName="StreetlightIndex",
                KeyConditionExpression=Key("streetlight_id").eq(
                    streetlight_id
                ),
                ProjectionExpression="tenant_id",
                Limit=1,
            )
            items = result.get("Items", [])
            if not items:
                raise ValueError(
                    f"No tenant found for streetlight {streetlight_id}"
                )
            return items[0]["tenant_id"]
        except Exception as e:
            if isinstance(e, ValueError):
                raise e
            raise PersistenceError(
                f"Failed to query tenant for streetlight {streetlight_id}"
            ) from e

    def get(
        self,
        tenant_id: str,
        streetlight_id: str,
    ) -> Optional[Streetlight]:
        try:
            result = self._table.get_item(
                Key={
                    "tenant_id": tenant_id,
                    "streetlight_id": streetlight_id,
                }
            )
            item = result.get("Item")
            if not item:
                return None
            return Streetlight(
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
        except Exception as e:
            raise PersistenceError(
                f"Error retrieving streetlight {streetlight_id}"
            ) from e


@lru_cache(maxsize=1)
def get_streetlights_repo() -> StreetlightsRepo:
    from libs.config import settings

    return StreetlightsRepo(
        table_name=settings.DDB_TABLE_STREETLIGHTS
    )
