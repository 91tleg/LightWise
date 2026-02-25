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
    last_seen: Optional[str] = None  # ISO 8601

    def to_dict(self) -> dict:
        return {
            "streetlight_id": self.streetlight_id,
            "tenant_id": self.tenant_id,
            "health": self.health.value,
            "lat": self.lat,
            "lng": self.lng,
            "name": self.name,
            "last_seen": self.last_seen,
        }
