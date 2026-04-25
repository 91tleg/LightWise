from __future__ import annotations
import pytest
from datetime import datetime, timezone
from unittest.mock import MagicMock

from application.streetlight.responses import (
    StreetlightResponse,
    heartbeat_to_ws_message,
    streetlight_to_list_item,
    streetlight_to_response,
    telemetry_to_ws_message,
)


@pytest.fixture
def now() -> datetime:
    return datetime(2026, 4, 7, 12, 0, 0, tzinfo=timezone.utc)


@pytest.fixture
def mock_state(now: datetime) -> MagicMock:
    state = MagicMock()
    state.streetlight_id = "SL-001"
    state.tenant_id = "tenant-55"
    state.health.name = "OK"
    state.last_seen = now
    state.motion_detected = True
    state.light_level = 80
    state.temp_c = 22
    state.humidity = 61
    state.lux = 123.4
    state.diagnostics.overall_ok = True
    state.diagnostics.ambient_health.name = "SYSTEM_OK"
    state.diagnostics.mmwave_health.name = "SYSTEM_OK"
    state.diagnostics.th_ok = True
    state.diagnostics.light_ok = True
    state.rssi = -65
    state.snr = 10.0
    return state


@pytest.fixture
def mock_metadata(now: datetime) -> MagicMock:
    metadata = MagicMock()
    metadata.streetlight_id = "SL-001"
    metadata.lat = 45.523
    metadata.lng = -122.676
    metadata.name = "Main St Light"
    metadata.site_id = "SITE-1"
    metadata.model = "X-100"
    metadata.installed_at = now
    return metadata


@pytest.fixture
def mock_report(now: datetime) -> MagicMock:
    report = MagicMock()
    report.streetlight_id = "SL-001"
    report.tenant_id = "tenant-55"
    report.site_id = "SITE-1"
    report.timestamp = now
    report.readings.lux = 150.5
    report.readings.temperature_c = 22
    report.readings.humidity = 61
    report.readings.motion_detected = True
    report.readings.light_level = 80
    report.diagnostics.overall_ok = True
    report.diagnostics.ambient_health.name = "SYSTEM_OK"
    report.diagnostics.mmwave_health.name = "SYSTEM_OK"
    report.diagnostics.th_ok = True
    report.diagnostics.light_ok = True
    return report


class TestStreetlightToResponse:
    def test_full_data(self, mock_state, mock_metadata, now):
        result = streetlight_to_response(
            StreetlightResponse(state=mock_state, metadata=mock_metadata)
        )
        assert result["streetlight_id"] == "SL-001"
        assert result["tenant_id"] == "tenant-55"
        assert result["health"] == "OK"
        assert result["last_seen"] == now.isoformat()
        assert result["motion_detected"] is True
        assert result["light_level"] == 80
        assert result["temp_c"] == 22
        assert result["humidity"] == 61
        assert result["lux"] == 123.4
        assert result["rssi"] == -65
        assert result["snr"] == 10.0
        assert result["lat"] == 45.523
        assert result["lng"] == -122.676
        assert result["name"] == "Main St Light"
        assert result["site_id"] == "SITE-1"
        assert result["model"] == "X-100"
        assert result["installed_at"] == now.isoformat()

    def test_diagnostics(self, mock_state, mock_metadata):
        result = streetlight_to_response(
            StreetlightResponse(state=mock_state, metadata=mock_metadata)
        )
        assert result["diagnostics"]["overall_ok"] is True
        assert result["diagnostics"]["ambient_health"] == "SYSTEM_OK"
        assert result["diagnostics"]["mmwave_health"] == "SYSTEM_OK"
        assert result["diagnostics"]["th_ok"] is True
        assert result["diagnostics"]["light_ok"] is True

    def test_no_metadata_returns_none_fields(self, mock_state):
        result = streetlight_to_response(
            StreetlightResponse(state=mock_state, metadata=None)
        )
        assert result["lat"] is None
        assert result["lng"] is None
        assert result["name"] is None
        assert result["site_id"] is None
        assert result["model"] is None
        assert result["installed_at"] is None

    def test_state_fields_present_without_metadata(self, mock_state):
        result = streetlight_to_response(
            StreetlightResponse(state=mock_state, metadata=None)
        )
        assert result["temp_c"] == 22
        assert result["humidity"] == 61
        assert result["lux"] == 123.4


class TestTelemetryToWsMessage:
    def test_event_type(self, mock_report):
        result = telemetry_to_ws_message(mock_report, MagicMock())
        assert result["event"] == "telemetry"

    def test_health_name(self, mock_report):
        health = MagicMock()
        health.name = "DEGRADED"
        result = telemetry_to_ws_message(mock_report, health)
        assert result["health"] == "DEGRADED"

    def test_data_fields(self, mock_report):
        result = telemetry_to_ws_message(mock_report, MagicMock())
        assert result["data"]["lux"] == 150.5
        assert result["data"]["temp_c"] == 22
        assert result["data"]["humidity"] == 61
        assert result["data"]["light_level"] == 80

    def test_motion_detected_from_readings(self, mock_report):
        """
        motion_detected in output maps to report.readings.motion_detected.
        """
        mock_report.readings.motion_detected = True
        result = telemetry_to_ws_message(mock_report, MagicMock())
        assert result["data"]["motion_detected"] is True

    def test_timestamp_is_isoformat(self, mock_report, now):
        result = telemetry_to_ws_message(mock_report, MagicMock())
        assert result["timestamp"] == now.isoformat()

    def test_identity_fields(self, mock_report):
        result = telemetry_to_ws_message(mock_report, MagicMock())
        assert result["streetlight_id"] == "SL-001"
        assert result["tenant_id"] == "tenant-55"
        assert result["site_id"] == "SITE-1"

    def test_diagnostics(self, mock_report):
        result = telemetry_to_ws_message(mock_report, MagicMock())
        assert result["diagnostics"]["overall_ok"] is True
        assert result["diagnostics"]["ambient_health"] == "SYSTEM_OK"


class TestHeartbeatToWsMessage:
    def test_fields(self, now):
        heartbeat = MagicMock()
        heartbeat.streetlight_id = "SL-001"
        heartbeat.tenant_id = "tenant-55"
        heartbeat.site_id = "SITE-1"
        heartbeat.timestamp = now
        result = heartbeat_to_ws_message(heartbeat)
        assert result["event"] == "heartbeat"
        assert result["status"] == "online"
        assert result["streetlight_id"] == "SL-001"
        assert result["timestamp"] == now.isoformat()


class TestStreetlightToListItem:
    def test_full_data(self, mock_state, mock_metadata):
        result = streetlight_to_list_item(mock_state, mock_metadata)
        assert result["streetlight_id"] == "SL-001"
        assert result["name"] == "Main St Light"
        assert result["site_id"] == "SITE-1"
        assert result["health"] == "OK"
        assert result["motion_detected"] is True
        assert result["light_level"] == 80
        assert result["temp_c"] == 22
        assert result["humidity"] == 61
        assert result["lux"] == 123.4
        assert result["rssi"] == -65
        assert result["snr"] == 10.0
        assert result["location"]["lat"] == 45.523
        assert result["location"]["lng"] == -122.676

    def test_no_metadata(self, mock_state):
        result = streetlight_to_list_item(mock_state, None)
        assert result["name"] is None
        assert result["site_id"] is None
        assert result["location"]["lat"] is None
        assert result["location"]["lng"] is None

    def test_state_fields_present_without_metadata(self, mock_state):
        result = streetlight_to_list_item(mock_state, None)
        assert result["temp_c"] == 22
        assert result["humidity"] == 61
        assert result["lux"] == 123.4

    def test_diagnostics(self, mock_state, mock_metadata):
        result = streetlight_to_list_item(mock_state, mock_metadata)
        assert result["diagnostics"]["overall_ok"] is True
        assert result["diagnostics"]["ambient_health"] == "SYSTEM_OK"
        assert result["diagnostics"]["mmwave_health"] == "SYSTEM_OK"
        assert result["diagnostics"]["th_ok"] is True
        assert result["diagnostics"]["light_ok"] is True
