from dataclasses import dataclass
from typing import Optional
from domain.streetlight.health import HealthStatus


@dataclass(frozen=True)
class Streetlight:
    streetlight_id: str
    tenant_id: str
    health: HealthStatus
    lat: Optional[float] = None
    lng: Optional[float] = None
    name: Optional[str] = None
    last_seen: Optional[str] = None
    motion_detected: Optional[bool] = None
    ambient_primary_ok: Optional[bool] = None
    ambient_secondary_ok: Optional[bool] = None
    th_ok: Optional[bool] = None
    motion_primary_ok: Optional[bool] = None
    motion_secondary_ok: Optional[bool] = None

    def to_dict(self) -> dict:
        return {
            "streetlight_id": self.streetlight_id,
            "tenant_id": self.tenant_id,
            "health": self.health.value,
            "lat": self.lat,
            "lng": self.lng,
            "name": self.name,
            "last_seen": self.last_seen,
            "motion_detected": self.motion_detected,
            "ambient_primary_ok": self.ambient_primary_ok,
            "ambient_secondary_ok": self.ambient_secondary_ok,
            "th_ok": self.th_ok,
            "motion_primary_ok": self.motion_primary_ok,
            "motion_secondary_ok": self.motion_secondary_ok,
        }
