from dataclasses import dataclass
from datetime import datetime, timezone, timedelta


@dataclass(frozen=True)
class WebSocketConnection:
    tenant_id: str
    user_id: str
    connection_id: str
    connected_at: datetime

    def __post_init__(self) -> None:
        if self.connected_at.tzinfo is None:
            raise ValueError("connected_at must be timezone aware")

    def is_active(self, timeout_minutes: int = 120) -> bool:
        now = datetime.now(timezone.utc)
        return now - self.connected_at < timedelta(minutes=timeout_minutes)
