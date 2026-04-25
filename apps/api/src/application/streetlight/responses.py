"""
Streetlight application response objects and mappers.
"""

from __future__ import annotations
from typing import Any
from dataclasses import dataclass

from domain.streetlight.events import Heartbeat, TelemetryReport
from domain.streetlight.health import HealthStatus
from domain.streetlight.models import StreetlightState, StreetlightMetadata


@dataclass(frozen=True)
class StreetlightResponse:
    """
    Read model for the frontend dashboard.
    """
    state: StreetlightState
    metadata: StreetlightMetadata | None


def streetlight_to_response(response: StreetlightResponse) -> dict:
    s = response.state
    m = response.metadata
    return {
        "streetlight_id": s.streetlight_id,
        "tenant_id": s.tenant_id,
        "health": s.health.name,
        "last_seen": s.last_seen.isoformat(),
        "motion_detected": s.motion_detected,
        "light_level": s.light_level,
        "diagnostics": {
            "overall_ok": s.diagnostics.overall_ok,
            "ambient_health": s.diagnostics.ambient_health.name,
            "mmwave_health": s.diagnostics.mmwave_health.name,
            "th_ok": s.diagnostics.th_ok,
            "light_ok": s.diagnostics.light_ok,
        },
        "rssi": s.rssi,
        "snr": s.snr,
        "lat": m.lat if m else None,
        "lng": m.lng if m else None,
        "name": m.name if m else None,
        "site_id": m.site_id if m else None,
        "model": m.model if m else None,
        "installed_at": m.installed_at.isoformat() if m else None,
    }


def telemetry_to_ws_message(
    report: TelemetryReport, health: HealthStatus
) -> dict:
    return {
        "event": "telemetry",
        "streetlight_id": report.streetlight_id,
        "tenant_id": report.tenant_id,
        "site_id": report.site_id,
        "timestamp": report.timestamp.isoformat(),
        "health": health.name,
        "data": {
            "lux": report.readings.lux,
            "temp_c": report.readings.temperature_c,
            "humidity": report.readings.humidity,
            "motion_detected": report.readings.motion_detected,
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


def heartbeat_to_ws_message(heartbeat: Heartbeat) -> dict:
    return {
        "event": "heartbeat",
        "streetlight_id": heartbeat.streetlight_id,
        "tenant_id": heartbeat.tenant_id,
        "site_id": heartbeat.site_id,
        "timestamp": heartbeat.timestamp.isoformat(),
        "status": "online",
    }


def streetlight_to_list_item(
    state: StreetlightState,
    metadata: StreetlightMetadata | None,
) -> dict[str, Any]:
    return {
        "streetlight_id": state.streetlight_id,
        "name": metadata.name if metadata else None,
        "site_id": metadata.site_id if metadata else None,
        "health": state.health.name,
        "last_seen": state.last_seen.isoformat(),
        "motion_detected": state.motion_detected,
        "light_level": state.light_level,
        "diagnostics": {
            "overall_ok": state.diagnostics.overall_ok,
            "ambient_health": state.diagnostics.ambient_health.name,
            "mmwave_health": state.diagnostics.mmwave_health.name,
            "th_ok": state.diagnostics.th_ok,
            "light_ok": state.diagnostics.light_ok,
        },
        "rssi": state.rssi,
        "snr": state.snr,
        "location": {
            "lat": metadata.lat if metadata else None,
            "lng": metadata.lng if metadata else None,
        },
    }
