"""
Streetlight domain models.

Two distinct concepts live here:

  StreetlightState    - operational state, updated on every uplink.
                        Maps to the Streetlights DynamoDB table.

  StreetlightMetadata - static provisioning info, updated only on
                        install or manual edit.
                        Maps to the StreetlightMetadata DynamoDB table.
"""

from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime

from domain.streetlight.health import HealthStatus, SensorDiagnostics


@dataclass(frozen=True)
class StreetlightState:
    """
    Latest-known operational state of a streetlight.

    Updated by the telemetry pipeline on every uplink.
    """
    streetlight_id: str
    tenant_id: str
    health: HealthStatus
    last_seen: datetime
    motion_detected: bool
    light_level: int
    diagnostics: SensorDiagnostics
    rssi: int | None
    snr: float | None

    def __post_init__(self) -> None:
        if self.last_seen.tzinfo is None:
            raise ValueError("last_seen must be timezone-aware")

    def is_offline(self, now: datetime, threshold_seconds: int = 180) -> bool:
        """
        True if the device has not reported within threshold_seconds.
        """
        return (now - self.last_seen).total_seconds() > threshold_seconds

    @property
    def requires_maintenance(self) -> bool:
        """
        True if the streetlight needs physical visit.
        """
        return self.health is HealthStatus.CRITICAL

    @property
    def is_healthy(self) -> bool:
        return self.health is HealthStatus.OK


@dataclass(frozen=True)
class StreetlightMetadata:
    """
    Static provisioning info for a streetlight.

    Written at installation time and updated via the metadata API.
    Not used by the telemetry pipeline.
    """
    streetlight_id: str
    wireless_device_id: str
    site_id: str
    lat: float | None
    lng: float | None
    name: str | None
    model: str
    installed_at: datetime

    def __post_init__(self) -> None:
        if self.lat is not None and not (-90.0 <= self.lat <= 90.0):
            raise ValueError(f"Invalid latitude: {self.lat}")
        if self.lng is not None and not (-180.0 <= self.lng <= 180.0):
            raise ValueError(f"Invalid longitude: {self.lng}")
        if self.installed_at.tzinfo is None:
            raise ValueError("installed_at must be timezone aware")
