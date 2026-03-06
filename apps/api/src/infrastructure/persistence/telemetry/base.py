from abc import ABC, abstractmethod
from datetime import datetime

from domain.telemetry.models import TelemetryPayload


class TelemetryReader(ABC):
    @abstractmethod
    def get_telemetry(
        self,
        streetlight_id: str,
        from_dt: datetime,
        to_dt: datetime,
        interval: str = "1m",
    ) -> list[dict]:
        """
        Return aggregated telemetry rows for a streetlight
        over a time range.
        """
        ...


class TelemetryWriter(ABC):
    @abstractmethod
    def write(self, event: TelemetryPayload) -> None:
        """Persist a single telemetry event."""
        ...
