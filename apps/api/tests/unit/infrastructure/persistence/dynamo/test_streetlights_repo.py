from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal
from unittest.mock import MagicMock, patch

from domain.streetlight.events import SensorReadings, TelemetryReport
from domain.streetlight.health import (
    HealthStatus,
    SensorDiagnostics,
    SensorHealth,
)
from infrastructure.persistence.dynamo.streetlights_repo import (
    StreetlightsRepo,
)


_NOW = datetime(2026, 4, 21, 19, 8, tzinfo=timezone.utc)


def _build_repo(table: MagicMock) -> StreetlightsRepo:
    fake_db = MagicMock()
    fake_db.Table.return_value = table

    with patch(
        "infrastructure.persistence.dynamo.streetlights_repo"
        ".get_dynamodb_resource",
        return_value=fake_db,
    ):
        return StreetlightsRepo("Streetlights")


def _telemetry(motion_detected: bool = True) -> TelemetryReport:
    return TelemetryReport(
        streetlight_id="LW-00043",
        tenant_id="tenant-001",
        site_id="site-001",
        timestamp=_NOW,
        readings=SensorReadings(
            lux=123.4,
            temperature_c=22,
            humidity=61,
            light_level=78,
            motion_detected=motion_detected,
        ),
        diagnostics=SensorDiagnostics(
            ambient_health=SensorHealth.SYSTEM_OK,
            mmwave_health=SensorHealth.SYSTEM_OK,
            th_ok=True,
            light_ok=True,
            overall_ok=True,
        ),
        rssi=-70,
        snr=8.5,
    )


def test_update_state_uses_domain_motion_detected_and_latest_readings():
    table = MagicMock()
    repo = _build_repo(table)

    repo.update_state(_telemetry(motion_detected=True), HealthStatus.OK)

    values = table.update_item.call_args.kwargs["ExpressionAttributeValues"]
    assert values[":m"] is True
    assert values[":tc"] == 22
    assert values[":hum"] == 61
    assert values[":lvl"] == 78
    assert values[":l"] == Decimal("123.4")


def test_from_item_maps_latest_sensor_readings():
    state = StreetlightsRepo._from_item(
        {
            "streetlight_id": "LW-00043",
            "tenant_id": "tenant-001",
            "health_status": HealthStatus.OK.value,
            "last_seen": _NOW.isoformat(),
            "motion_detected": False,
            "light_level": Decimal("52"),
            "temp_c": Decimal("19"),
            "humidity": Decimal("58"),
            "last_lux": Decimal("88.2"),
            "ambient_health": SensorHealth.SYSTEM_OK.value,
            "mmwave_health": SensorHealth.SYSTEM_OK.value,
            "th_ok": True,
            "light_ok": True,
            "overall_ok": True,
            "rssi": Decimal("-67"),
            "snr": Decimal("7.5"),
        }
    )

    assert state.motion_detected is False
    assert state.light_level == 52
    assert state.temp_c == 19
    assert state.humidity == 58
    assert state.lux == 88.2
