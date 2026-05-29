from __future__ import annotations
from datetime import datetime, timezone
from unittest.mock import MagicMock

from application.streetlight.list_streetlights import ListStreetlights
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


def _state(
    streetlight_id: str, tenant_id: str = "tenant-1"
) -> StreetlightState:
    return StreetlightState(
        streetlight_id=streetlight_id,
        tenant_id=tenant_id,
        health=HealthStatus.OK,
        last_seen=_NOW,
        motion_detected=False,
        light_level=80,
        diagnostics=_DIAGNOSTICS,
        rssi=-70,
        snr=8.0,
    )


def _metadata(
    streetlight_id: str,
    name: str | None = "Test Light",
) -> StreetlightMetadata:
    return StreetlightMetadata(
        streetlight_id=streetlight_id,
        wireless_device_id=f"dev-{streetlight_id}",
        site_id="site-1",
        lat=37.77,
        lng=-122.41,
        name=name,
        model="LUM-MAX-200",
        installed_at=_INSTALLED,
    )


def _use_case(
    states: list[StreetlightState],
    metadata: list[StreetlightMetadata],
) -> ListStreetlights:
    state_repo = MagicMock()
    state_repo.list_by_tenant.return_value = states
    metadata_repo = MagicMock()
    metadata_repo.list_by_tenant.return_value = metadata
    return ListStreetlights(state_repo=state_repo, metadata_repo=metadata_repo)


class TestListStreetlights:
    def test_returns_empty_when_no_states(self):
        use_case = _use_case(states=[], metadata=[])
        assert use_case.execute("tenant-1") == []

    def test_returns_response_for_each_state(self):
        states = [_state("sl-001"), _state("sl-002")]
        metadata = [_metadata("sl-001"), _metadata("sl-002")]
        results = _use_case(states, metadata).execute("tenant-1")
        assert len(results) == 2

    def test_state_and_metadata_joined_correctly(self):
        states = [_state("sl-001")]
        meta = _metadata("sl-001", name="Main St")
        results = _use_case(states, [meta]).execute("tenant-1")
        assert results[0].state.streetlight_id == "sl-001"
        assert results[0].metadata.name == "Main St"

    def test_repos_called_with_tenant_id(self):
        state_repo = MagicMock()
        state_repo.list_by_tenant.return_value = []
        metadata_repo = MagicMock()
        metadata_repo.list_by_tenant.return_value = []
        use_case = ListStreetlights(
            state_repo=state_repo, metadata_repo=metadata_repo
        )
        use_case.execute("tenant-abc")
        state_repo.list_by_tenant.assert_called_once_with("tenant-abc")
        metadata_repo.list_by_tenant.assert_called_once_with("tenant-abc")


class TestMissingMetadata:
    def test_state_without_metadata_is_included(self):
        states = [_state("sl-001")]
        results = _use_case(states, metadata=[]).execute("tenant-1")
        assert len(results) == 1
        assert results[0].metadata is None

    def test_state_without_metadata_sorts_first(self):
        states = [_state("sl-001"), _state("sl-002")]
        metadata = [_metadata("sl-002", name="Zebra St")]
        results = _use_case(states, metadata).execute("tenant-1")
        assert results[0].state.streetlight_id == "sl-001"
        assert results[1].state.streetlight_id == "sl-002"

    def test_metadata_without_matching_state_is_ignored(self):
        states = [_state("sl-001")]
        metadata = [_metadata("sl-001"), _metadata("sl-999")]
        results = _use_case(states, metadata).execute("tenant-1")
        assert len(results) == 1
        assert results[0].state.streetlight_id == "sl-001"


class TestSortOrder:
    def test_sorted_by_name_alphabetically(self):
        states = [_state("sl-001"), _state("sl-002"), _state("sl-003")]
        metadata = [
            _metadata("sl-001", name="Zebra Ave"),
            _metadata("sl-002", name="Apple St"),
            _metadata("sl-003", name="Mango Rd"),
        ]
        results = _use_case(states, metadata).execute("tenant-1")
        names = [r.metadata.name for r in results]
        assert names == ["Apple St", "Mango Rd", "Zebra Ave"]

    def test_none_name_sorts_before_named(self):
        states = [_state("sl-001"), _state("sl-002")]
        metadata = [
            _metadata("sl-001", name=None),
            _metadata("sl-002", name="Alpha St"),
        ]
        results = _use_case(states, metadata).execute("tenant-1")
        assert results[0].state.streetlight_id == "sl-001"
        assert results[1].state.streetlight_id == "sl-002"

    def test_stable_sort_with_duplicate_names(self):
        states = [_state("sl-001"), _state("sl-002")]
        metadata = [
            _metadata("sl-001", name="Same St"),
            _metadata("sl-002", name="Same St"),
        ]
        results = _use_case(states, metadata).execute("tenant-1")
        assert len(results) == 2
