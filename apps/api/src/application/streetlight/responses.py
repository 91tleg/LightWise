"""
Streetlight application response objects and mappers.
"""

from __future__ import annotations
from typing import Any
from dataclasses import dataclass

from domain.streetlight.events import TelemetryReport
from domain.streetlight.health import HealthStatus
from domain.streetlight.models import StreetlightState, StreetlightMetadata


@dataclass(frozen=True)
class StreetlightResponse:
    """
    Read model for the frontend dashboard.
    """
    state: StreetlightState
    metadata: StreetlightMetadata


def streetlight_to_response(response: StreetlightResponse) -> dict:
    """
    Serialise a StreetlightResponse to a dict for the API handler.
    Called at the handler boundary only.
    """
    s = response.state
    m = response.metadata
    return {
        "streetlight_id": s.streetlight_id,
        "tenant_id": s.tenant_id,
        "health": s.health.name,
        "last_seen": s.last_seen.isoformat(),
        "motion_detected": s.motion_detected,
        "diagnostics": {
            "overall_ok": s.diagnostics.overall_ok,
            "ambient_health": s.diagnostics.ambient_health.name,
            "mmwave_health": s.diagnostics.mmwave_health.name,
            "th_ok": s.diagnostics.th_ok,
            "light_ok": s.diagnostics.light_ok,
        },
        "rssi": s.rssi,
        "snr": s.snr,
        "lat": m.lat,
        "lng": m.lng,
        "name": m.name,
        "site_id": m.site_id,
        "model": m.model,
        "installed_at": m.installed_at.isoformat(),
    }


def telemetry_to_ws_message(
    report: TelemetryReport, health: HealthStatus
) -> dict:
    """
    Serialise a TelemetryReport to a WebSocket broadcast message.
    Called by ProcessUplink after health evaluation.
    """
    return {
        "streetlight_id": report.streetlight_id,
        "tenant_id": report.tenant_id,
        "site_id": report.site_id,
        "timestamp": report.timestamp.isoformat(),
        "health": health.name,
        "data": {
            "lux": report.readings.lux,
            "temp_c": report.readings.temperature_c,
            "humidity": report.readings.humidity,
            "motion": report.readings.motion,
            "light_level": report.readings.light_level,
        },
        "diagnostics": {
            "overall_ok": report.diagnostics.overall_ok,
            "ambient_health": report.diagnostics.ambient_health.name,
            "mmwave_health": report.diagnostics.mmwave_health.name,
            "th_ok": report.diagnostics.th_ok,
            "light_ok": report.diagnostics.light_ok,
        },
    }


def streetlight_to_list_item(
    state: StreetlightState,
    metadata: StreetlightMetadata
) -> dict[str, Any]:
    """
    The fleet view mapping.
    """
    return {
        "streetlight_id": state.streetlight_id,
        "name": metadata.name,
        "site_id": metadata.site_id,
        "health": state.health.name,
        "status": state.status.name,
        "last_seen": state.last_seen.isoformat(),
        "location": {
            "lat": metadata.lat,
            "lng": metadata.lng
        }
    }
