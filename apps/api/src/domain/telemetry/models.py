from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class TelemetryPayload:
    tenant_id: str
    device_id: str

    # Sensor readings
    lux: float
    temperature_c: int
    humidity: int
    motion: bool
    light_level: int

    timestamp: datetime

    # Sensor health flags
    ambient_primary_ok: bool = True
    ambient_secondary_ok: bool = True
    th_ok: bool = True
    motion_primary_ok: bool = True
    motion_secondary_ok: bool = True
    overall_ok: bool = True
    system_degraded: bool = False

    def to_dict(self):
        return {
            # Identity
            "tenant_id": self.tenant_id,
            "device_id": self.device_id,
            "timestamp": (
                self.timestamp.isoformat()
                if self.timestamp
                else None
            ),

            # Measurements (Live data)
            "data": {
                "lux": self.lux,
                "temp_c": self.temperature_c,
                "humidity": self.humidity,
                "motion": self.motion,
                "light_level": self.light_level,
            },

            # Diagnostics (Health data)
            "diagnostics": {
                "overall_ok": self.overall_ok,
                "system_degraded": self.system_degraded,
                "ambient_primary_ok": self.ambient_primary_ok,
                "ambient_secondary_ok": self.ambient_secondary_ok,
                "th_ok": self.th_ok,
                "motion_primary_ok": self.motion_primary_ok,
                "motion_secondary_ok": self.motion_secondary_ok,
            }
        }
