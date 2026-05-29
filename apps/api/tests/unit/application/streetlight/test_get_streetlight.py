from __future__ import annotations
from datetime import datetime, timezone
from unittest.mock import MagicMock

from application.streetlight.get_streetlight import GetStreetlight
from domain.streetlight.health import (
    HealthStatus,
    SensorDiagnostics,
    SensorHealth,
)
from domain.streetlight.models import StreetlightMetadata, StreetlightState


_NOW = datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc)
_INSTALLED = datetime(2023, 6, 1, 0, 0, 0, tzinfo=timezone.utc)

_DIAGNOSTICS = SensorDiagnostics(
    ambient_health=SensorHealth.SYSTEM_OK,
    mmwave_health=SensorHealth.SYSTEM_OK,
    th_ok=True,
    light_ok=True,
    overall_ok=True,
)

_STATE = StreetlightState(
    streetlight_id="sl-001",
    tenant_id="tenant-1",
    health=HealthStatus.OK,
    last_seen=_NOW,
    motion_detected=False,
    light_level=80,
    diagnostics=_DIAGNOSTICS,
    rssi=-70,
    snr=8.0,
)

_METADATA = StreetlightMetadata(
    streetlight_id="sl-001",
    wireless_device_id="dev-001",
    site_id="site-1",
    lat=37.77,
    lng=-122.41,
    name="Main St",
    model="LUM-MAX-200",
    installed_at=_INSTALLED,
)


def _use_case(
    state: StreetlightState | None,
    metadata: StreetlightMetadata | None,
) -> GetStreetlight:
    repo = MagicMock()
    repo.get.return_value = state
    metadata_repo = MagicMock()
    metadata_repo.get.return_value = metadata
    return GetStreetlight(repo=repo, metadata_repo=metadata_repo)


class TestGetStreetlight:
    def test_returns_none_when_state_not_found(self):
        use_case = _use_case(state=None, metadata=None)
        assert use_case.execute("tenant-1", "sl-001") is None

    def test_metadata_not_fetched_when_state_missing(self):
        repo = MagicMock()
        repo.get.return_value = None
        metadata_repo = MagicMock()
        use_case = GetStreetlight(repo=repo, metadata_repo=metadata_repo)
        use_case.execute("tenant-1", "sl-001")
        metadata_repo.get.assert_not_called()

    def test_returns_response_with_state_and_metadata(self):
        result = _use_case(_STATE, _METADATA).execute("tenant-1", "sl-001")
        assert result is not None
        assert result.state == _STATE
        assert result.metadata == _METADATA

    def test_returns_response_with_missing_metadata(self):
        result = _use_case(_STATE, metadata=None).execute("tenant-1", "sl-001")
        assert result is not None
        assert result.state == _STATE
        assert result.metadata is None

    def test_repos_called_with_tenant_and_streetlight_id(self):
        repo = MagicMock()
        repo.get.return_value = _STATE
        metadata_repo = MagicMock()
        metadata_repo.get.return_value = _METADATA
        use_case = GetStreetlight(repo=repo, metadata_repo=metadata_repo)
        use_case.execute("tenant-1", "sl-001")
        repo.get.assert_called_once_with("tenant-1", "sl-001")
        metadata_repo.get.assert_called_once_with("tenant-1", "sl-001")

    def test_state_from_different_tenant_not_returned(self):
        repo = MagicMock()
        repo.get.return_value = None
        metadata_repo = MagicMock()
        use_case = GetStreetlight(repo=repo, metadata_repo=metadata_repo)
        result = use_case.execute("tenant-2", "sl-001")
        assert result is None
        repo.get.assert_called_once_with("tenant-2", "sl-001")
