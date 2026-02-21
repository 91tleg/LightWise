from dataclasses import dataclass
from datetime import datetime, timezone, timedelta

@dataclass(frozen=True) 
class WebSocketConnection:
    tenant_id: str
    user_id: str
    connection_id: str
    connected_at: datetime

    def is_active(self, timeout_minutes: int = 120) -> bool:
        """
        Check if the connection is still valid based on the heartbeat/connected time.
        Using UTC to avoid server-local time issues.
        """
        # Ensure we compare UTC to UTC
        now = datetime.now(timezone.utc)
        return now - self.connected_at < timedelta(minutes=timeout_minutes)
        