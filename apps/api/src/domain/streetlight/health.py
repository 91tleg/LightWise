from enum import Enum


class HealthStatus(Enum):
    OK = "OK"
    DEGRADED = "DEGRADED"
    CRITICAL = "CRITICAL"
    UNKNOWN = "UNKNOWN"

    def __str__(self):
        return self.value
