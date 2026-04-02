"""
Streetlight health domain objects.
"""

from __future__ import annotations
from dataclasses import dataclass
from enum import IntEnum


class SensorHealth(IntEnum):
    """
    3-bit health encoding shared by ambient and mmWave sensors.
    """
    TOTAL_FAILURE = 0b000   # No valid readings from either sensor
    PRIMARY_FAIL = 0b001    # Primary sensor unresponsive
    SECONDARY_FAIL = 0b010  # Secondary sensor unresponsive
    DEGRADED = 0b011        # Both responding but consistently disagreeing
    SYSTEM_OK = 0b100       # Both sensors healthy and agreeing

    @property
    def is_ok(self) -> bool:
        return self is SensorHealth.SYSTEM_OK

    @property
    def is_degraded(self) -> bool:
        return self is SensorHealth.DEGRADED

    @property
    def is_failed(self) -> bool:
        return self in (
            SensorHealth.TOTAL_FAILURE,
            SensorHealth.PRIMARY_FAIL,
            SensorHealth.SECONDARY_FAIL,
        )


@dataclass(frozen=True)
class SensorDiagnostics:
    """
    Health state of all on-board sensors.

    ambient_health and mmwave_health use the 3-bit SensorHealth encoding.
    th_ok and light_ok are binary.
    """
    ambient_health: SensorHealth
    mmwave_health: SensorHealth
    th_ok: bool       # TH sensor healthy
    light_ok: bool    # Light drawing expected current
    overall_ok: bool  # All sensors healthy

    @property
    def any_sensor_failed(self) -> bool:
        return (
            self.ambient_health.is_failed
            or self.mmwave_health.is_failed
            or not self.th_ok
        )

    @property
    def any_sensor_degraded(self) -> bool:
        return (
            self.ambient_health.is_degraded
            or self.mmwave_health.is_degraded
        )


class HealthStatus(IntEnum):
    """
    Derived operational health status written to the Streetlights DynamoDB
    table by the telemetry pipeline.
    """
    OK = 1
    DEGRADED = 2
    CRITICAL = 3
