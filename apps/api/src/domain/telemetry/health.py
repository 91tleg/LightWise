from enum import Enum


class HealthStatus(Enum):
    OK = "OK"
    DEGRADED = "DEGRADED"
    CRITICAL = "CRITICAL"


    def __str__(self):
        return self.value
