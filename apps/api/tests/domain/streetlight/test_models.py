import pytest
from datetime import datetime, timezone, timedelta
from dataclasses import FrozenInstanceError

from domain.streetlight.health import HealthStatus, SensorDiagnostics
from domain.streetlight.models import StreetlightState, StreetlightMetadata


@pytest.fixture
def mock_diagnostics() -> SensorDiagnostics:
    return SensorDiagnostics(
        ambient_health=HealthStatus.OK,
        mmwave_health=HealthStatus.OK,
        th_ok=True,
        light_ok=True,
        overall_ok=True
    )


class TestStreetlightState:
    def test_valid_state_initialization(self, mock_diagnostics):
        now = datetime.now(timezone.utc)
        state = StreetlightState(
            streetlight_id="sl-123",
            tenant_id="tenant-A",
            health=HealthStatus.OK,
            last_seen=now,
            motion_detected=False,
            light_level=80,
            diagnostics=mock_diagnostics,
            rssi=-70,
            snr=9.5
        )
        assert state.is_healthy is True

    def test_requires_maintenance_mapping(self, mock_diagnostics):
        now = datetime.now(timezone.utc)

        state_ok = StreetlightState(
            "id", "t", HealthStatus.OK, now, False, 50,
            mock_diagnostics, -50, 5.0
        )
        state_crit = StreetlightState(
            "id", "t", HealthStatus.CRITICAL, now, False, 50,
            mock_diagnostics, -50, 5.0
        )

        assert state_ok.requires_maintenance is False
        assert state_crit.requires_maintenance is True

    def test_is_offline_logic(self, mock_diagnostics):
        now = datetime.now(timezone.utc)
        stale_time = now - timedelta(seconds=200)

        state = StreetlightState(
            "id", "t", HealthStatus.OK, stale_time, False, 50,
            mock_diagnostics, -50, 5.0
        )

        assert state.is_offline(now) is True

    def test_immutability(self, mock_diagnostics):
        state = StreetlightState(
            "id", "t", HealthStatus.OK, datetime.now(timezone.utc),
            False, 50, mock_diagnostics, -50, 5.0
        )
        with pytest.raises(FrozenInstanceError):
            state.light_level = 100


class TestStreetlightMetadata:
    def test_coordinate_validation(self):
        valid_at = datetime.now(timezone.utc)

        meta = StreetlightMetadata(
            "id", "w", "s", 45.0, -120.0, "n", "m", valid_at
        )
        assert meta.lat == 45.0

        with pytest.raises(ValueError, match="Invalid latitude"):
            StreetlightMetadata(
                "id", "w", "s", 91.0, 0.0, "n", "m", valid_at
            )

        with pytest.raises(ValueError, match="Invalid longitude"):
            StreetlightMetadata(
                "id", "w", "s", 0.0, 181.0, "n", "m", valid_at
            )

    def test_raises_on_naive_datetime(self):
        with pytest.raises(ValueError, match="timezone aware"):
            StreetlightMetadata(
                "id", "w", "s", 0, 0, "n", "m", datetime.now()
            )
