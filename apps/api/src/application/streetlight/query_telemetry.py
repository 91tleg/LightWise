from datetime import datetime, timedelta
from typing import Protocol


_INTERVAL_RULES = [
    (timedelta(days=30), "1d"),
    (timedelta(days=7), "1h"),
    (timedelta(hours=24), "5m"),
    (timedelta(hours=1), "1m"),
]

_INTERVAL_MINUTES = {"m": 1, "h": 60, "d": 1440}


def _interval_to_minutes(interval: str) -> int:
    return int(interval[:-1]) * _INTERVAL_MINUTES[interval[-1]]


def _resolve_interval(
    from_dt: datetime,
    to_dt: datetime,
    interval: str
) -> str:
    delta = to_dt - from_dt
    for threshold, minimum in _INTERVAL_RULES:
        if delta >= threshold:
            if _interval_to_minutes(interval) < _interval_to_minutes(minimum):
                return minimum
            return interval
    return interval


class TelemetryReader(Protocol):
    def get_telemetry(
        self,
        streetlight_id: str,
        from_dt: datetime,
        to_dt: datetime,
        interval: str
    ) -> list[dict]: ...


class QueryTelemetry:
    def __init__(self, reader: TelemetryReader):
        self.reader = reader

    def execute(
        self,
        streetlight_id: str,
        from_dt: datetime,
        to_dt: datetime,
        interval: str = "1h",
    ) -> list[dict]:
        interval = _resolve_interval(from_dt, to_dt, interval)
        data = self.reader.get_telemetry(
            streetlight_id=streetlight_id,
            from_dt=from_dt,
            to_dt=to_dt,
            interval=interval,
        )
        return data
