from decimal import Decimal
from functools import lru_cache
from datetime import datetime, timezone

from boto3.dynamodb.conditions import Key

from infrastructure.persistence.dynamo.client import get_dynamodb_resource
from infrastructure.persistence.error import PersistenceError
from domain.streetlight.events import TelemetryReport
from domain.streetlight.health import (
    HealthStatus, SensorDiagnostics, SensorHealth
)
from domain.streetlight.models import StreetlightState


class StreetlightsRepo:
    def __init__(self, table_name: str) -> None:
        self._db = get_dynamodb_resource()
        self._table = self._db.Table(table_name)

    def update_state(
        self,
        telemetry: TelemetryReport,
        health: HealthStatus,
    ) -> None:
        values = {
            ":l":   Decimal(str(telemetry.lux)),
            ":lvl": telemetry.light_level,
            ":h":   health.name,
            ":t":   telemetry.timestamp.isoformat(),
            ":m":   telemetry.motion_detected,
            ":ah":  telemetry.diagnostics.ambient_health.value,
            ":mh":  telemetry.diagnostics.mmwave_health.value,
            ":th":  telemetry.diagnostics.th_ok,
            ":lo":  telemetry.diagnostics.light_ok,
            ":ok":  telemetry.diagnostics.overall_ok,
            ":tc":  telemetry.readings.temperature_c,
            ":hum": telemetry.readings.humidity,
            ":lux": Decimal(str(telemetry.readings.lux)),
        }

        expr = (
            "SET last_lux = :l, "
            "light_level = :lvl, "
            "health_status = :h, "
            "last_seen = :t, "
            "motion_detected = :m, "
            "ambient_health = :ah, "
            "mmwave_health = :mh, "
            "th_ok = :th, "
            "light_ok = :lo, "
            "overall_ok = :ok, "
            "temp_c = :tc, "
            "humidity = :hum, "
            "lux = :lux"
        )

        if telemetry.rssi is not None:
            expr += ", rssi = :rssi"
            values[":rssi"] = telemetry.rssi

        if telemetry.snr is not None:
            expr += ", snr = :snr"
            values[":snr"] = Decimal(str(telemetry.snr))

        try:
            self._table.update_item(
                Key={
                    "tenant_id": telemetry.tenant_id,
                    "streetlight_id": telemetry.streetlight_id,
                },
                UpdateExpression=expr,
                ExpressionAttributeValues=values,
            )
        except Exception as e:
            raise PersistenceError(
                f"Database update failed for {telemetry.streetlight_id}"
            ) from e

    def update_last_seen(self, tenant_id: str, streetlight_id: str) -> None:
        try:
            self._table.update_item(
                Key={
                    "tenant_id": tenant_id,
                    "streetlight_id": streetlight_id,
                },
                UpdateExpression="SET last_seen = :t",
                ExpressionAttributeValues={
                    ":t": datetime.now(timezone.utc).isoformat(),
                },
            )
        except Exception as e:
            raise PersistenceError(
                f"Database update failed for {streetlight_id}"
            ) from e

    def list_by_tenant(self, tenant_id: str) -> list[StreetlightState]:
        try:
            items = []
            kwargs = {"KeyConditionExpression": Key("tenant_id").eq(tenant_id)}
            while True:
                response = self._table.query(**kwargs)
                items.extend(response.get("Items", []))
                last = response.get("LastEvaluatedKey")
                if not last:
                    break
                kwargs["ExclusiveStartKey"] = last
            return [self._from_item(item) for item in items]
        except Exception as e:
            raise PersistenceError(
                f"Could not retrieve streetlights for tenant {tenant_id}"
            ) from e

    def get(
        self,
        tenant_id: str,
        streetlight_id: str,
    ) -> StreetlightState | None:
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
            return self._from_item(item)
        except Exception as e:
            raise PersistenceError(
                f"Error retrieving streetlight {streetlight_id}"
            ) from e

    def get_tenant_id(self, streetlight_id: str) -> str:
        try:
            result = self._table.query(
                IndexName="StreetlightIndex",
                KeyConditionExpression=Key(
                    "streetlight_id"
                ).eq(streetlight_id),
                ProjectionExpression="tenant_id",
                Limit=1,
            )
            items = result.get("Items", [])
            if not items:
                raise ValueError(
                    f"No tenant found for streetlight {streetlight_id}"
                )
            return items[0]["tenant_id"]
        except ValueError:
            raise
        except Exception as e:
            raise PersistenceError(
                f"Failed to query tenant for streetlight {streetlight_id}"
            ) from e

    @staticmethod
    def _parse_health(value: object) -> HealthStatus:
        """
        Handle both string names ('CRITICAL') and integer values (3).
        Legacy items stored integers; current items store names.
        """
        if isinstance(value, str):
            try:
                return HealthStatus[value]
            except KeyError:
                return HealthStatus.OK
        try:
            return HealthStatus(int(value))
        except (ValueError, TypeError):
            return HealthStatus.OK

    @staticmethod
    def _from_item(item: dict) -> StreetlightState:
        raw_lux = item.get("lux", item.get("last_lux"))
        return StreetlightState(
            streetlight_id=item["streetlight_id"],
            tenant_id=item["tenant_id"],
            health=StreetlightsRepo._parse_health(
                item.get("health_status", HealthStatus.OK.value)
            ),
            last_seen=datetime.fromisoformat(item["last_seen"]),
            motion_detected=item.get("motion_detected", False),
            light_level=int(item.get("light_level", 0)),
            diagnostics=SensorDiagnostics(
                ambient_health=SensorHealth(
                    item.get("ambient_health", SensorHealth.SYSTEM_OK.value)
                ),
                mmwave_health=SensorHealth(
                    item.get("mmwave_health", SensorHealth.SYSTEM_OK.value)
                ),
                th_ok=item.get("th_ok", False),
                light_ok=item.get("light_ok", False),
                overall_ok=item.get("overall_ok", False),
            ),
            rssi=int(item["rssi"]) if item.get("rssi") is not None else None,
            snr=float(item["snr"]) if item.get("snr") is not None else None,
            temp_c=int(
                item["temp_c"]
            ) if item.get("temp_c") is not None else None,
            humidity=int(
                item["humidity"]
            ) if item.get("humidity") is not None else None,
            lux=float(raw_lux) if raw_lux is not None else None,
        )


@lru_cache(maxsize=1)
def get_streetlights_repo() -> StreetlightsRepo:
    from libs.config import settings

    return StreetlightsRepo(
        table_name=settings.DDB_TABLE_STREETLIGHTS
    )
