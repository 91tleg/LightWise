from datetime import datetime, timezone
import pytest
from domain.telemetry.models import TelemetryPayload


@pytest.fixture
def payload():
    return TelemetryPayload(
        tenant_id="tenant-001",
        streetlight_id="LW-00100",
        lux=134.2,
        temperature_c=22,
        humidity=48,
        motion=True,
        light_level=80,
        timestamp=datetime(2026, 2, 16, 3, 41, 12, tzinfo=timezone.utc),
    )


def test_to_dict_structure(payload):
    result = payload.to_dict()
    assert result["tenant_id"] == "tenant-001"
    assert result["streetlight_id"] == "LW-00100"
    assert "data" in result
    assert "diagnostics" in result


def test_to_dict_data_fields(payload):
    data = payload.to_dict()["data"]
    assert data["lux"] == 134.2
    assert data["temp_c"] == 22
    assert data["humidity"] == 48
    assert data["motion"] is True
    assert data["light_level"] == 80


def test_to_dict_timestamp_iso(payload):
    result = payload.to_dict()
    assert result["timestamp"] == "2026-02-16T03:41:12+00:00"


def test_to_dict_timestamp_none():
    payload = TelemetryPayload(
        tenant_id="tenant-001",
        streetlight_id="LW-00100",
        lux=0.0,
        temperature_c=0,
        humidity=0,
        motion=False,
        light_level=0,
        timestamp=None,
    )
    assert payload.to_dict()["timestamp"] is None


def test_to_dict_default_flags(payload):
    diagnostics = payload.to_dict()["diagnostics"]
    assert diagnostics["overall_ok"] is True
    assert diagnostics["system_degraded"] is False
    assert diagnostics["ambient_primary_ok"] is True
    assert diagnostics["motion_primary_ok"] is True


def test_to_dict_degraded_flags():
    payload = TelemetryPayload(
        tenant_id="tenant-001",
        streetlight_id="LW-00100",
        lux=0.0,
        temperature_c=0,
        humidity=0,
        motion=False,
        light_level=0,
        timestamp=datetime(2026, 2, 16, tzinfo=timezone.utc),
        ambient_secondary_ok=False,
        system_degraded=True,
    )
    diagnostics = payload.to_dict()["diagnostics"]
    assert diagnostics["ambient_secondary_ok"] is False
    assert diagnostics["system_degraded"] is True
