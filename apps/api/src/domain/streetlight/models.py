from dataclasses import dataclass
from typing import Optional
from domain.telemetry.health import HealthStatus


@dataclass(frozen=True)
class StreetlightSummary:
    device_id: str
    tenant_id: str
    health: HealthStatus
    last_seen: Optional[str] = None  # ISO 8601 timestamp

    def to_dict(self) -> dict:
        return {
            "device_id": self.device_id,
            "tenant_id": self.tenant_id,
            "health": self.health.value,
            "last_seen": self.last_seen,
        }
