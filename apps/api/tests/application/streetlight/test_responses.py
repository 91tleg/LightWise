import pytest
from datetime import datetime, timezone
from unittest.mock import MagicMock
from application.streetlight.responses import (
    streetlight_to_response,
    telemetry_to_ws_message,
    streetlight_to_list_item,
    StreetlightResponse
)


@pytest.fixture
def sample_now():
    return datetime(2026, 4, 7, 12, 0, 0, tzinfo=timezone.utc)


@pytest.fixture
def mock_state(sample_now):
    state = MagicMock()
    state.streetlight_id = "SL-001"
    state.tenant_id = "tenant-55"
    state.health.name = "OK"
    state.last_seen = sample_now
    state.motion_detected = True
    state.diagnostics.overall_ok = True
    state.diagnostics.ambient_health.name = "OK"
    state.diagnostics.mmwave_health.name = "OK"
    state.diagnostics.th_ok = True
    state.diagnostics.light_ok = True
    state.rssi = -65
    state.snr = 10
    return state


@pytest.fixture
def mock_metadata(sample_now):
    metadata = MagicMock()
    metadata.lat = 45.523
    metadata.lng = -122.676
    metadata.name = "Main St Light"
    metadata.site_id = "SITE-1"
    metadata.model = "X-100"
    metadata.installed_at = sample_now
    metadata.streetlight_id = "SL-001"
    return metadata


def test_streetlight_to_response_full_data(mock_state, mock_metadata):
    response_obj = StreetlightResponse(
        state=mock_state, metadata=mock_metadata
    )
    result = streetlight_to_response(response_obj)

    assert result["streetlight_id"] == "SL-001"
    assert result["lat"] == 45.523
    assert "2026-04-07" in result["last_seen"]
    assert result["diagnostics"]["overall_ok"] is True


def test_streetlight_to_response_no_metadata(mock_state):
    response_obj = StreetlightResponse(state=mock_state, metadata=None)
    result = streetlight_to_response(response_obj)

    assert result["lat"] is None
    assert result["name"] is None
    assert result["installed_at"] is None


def test_telemetry_to_ws_message(sample_now):
    report = MagicMock()
    report.streetlight_id = "SL-001"
    report.timestamp = sample_now
    report.readings.lux = 150.5
    health = MagicMock()
    health.name = "DEGRADED"

    result = telemetry_to_ws_message(report, health)

    assert result["health"] == "DEGRADED"
    assert result["data"]["lux"] == 150.5
    assert isinstance(result["timestamp"], str)


def test_streetlight_to_list_item_mapping(mock_state, mock_metadata):
    result = streetlight_to_list_item(mock_state, mock_metadata)

    assert result["streetlight_id"] == "SL-001"
    assert result["location"]["lat"] == 45.523
    assert result["health"] == "OK"
