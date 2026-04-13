"""
TelemetryInterval domain value object.

Interval validation and window-based coercion rules.
"""

from __future__ import annotations
from datetime import datetime, timedelta


_ALLOWED_INTERVALS = frozenset({
    "1m", "5m", "10m", "15m", "30m",
    "1h", "6h", "12h",
    "1d", "7d", "30d",
})

# Evaluated largest-window first; first match wins.
# If window >= threshold, the minimum interval is enforced.
_COERCION_RULES: list[tuple[timedelta, str]] = [
    (timedelta(days=30),  "1d"),
    (timedelta(days=7),   "1h"),
    (timedelta(hours=24), "5m"),
    (timedelta(hours=1),  "1m"),
]

_INTERVAL_UNITS = {"m": 1, "h": 60, "d": 1440}


def _to_minutes(interval: str) -> int:
    return int(interval[:-1]) * _INTERVAL_UNITS[interval[-1]]


class TelemetryInterval:
    DEFAULT = "5m"

    def __init__(self, value: str) -> None:
        if value not in _ALLOWED_INTERVALS:
            raise ValueError(
                f"Invalid interval '{value}'. "
                f"Allowed values: {sorted(_ALLOWED_INTERVALS)}"
            )
        self._value = value

    @classmethod
    def default(cls) -> TelemetryInterval:
        return cls(cls.DEFAULT)

    def resolve_for_window(
        self, from_dt: datetime, to_dt: datetime
    ) -> TelemetryInterval:
        """
        Return the coarser of this interval and the minimum allowed for
        the given window. The caller's interval is preserved when it is
        already at or above the minimum; otherwise the minimum is returned.
        """
        delta = to_dt - from_dt
        for threshold, minimum in _COERCION_RULES:
            if delta >= threshold:
                if _to_minutes(self._value) < _to_minutes(minimum):
                    return TelemetryInterval(minimum)
                return self
        return self

    @property
    def value(self) -> str:
        return self._value

    def __eq__(self, other: object) -> bool:
        return isinstance(
            other, TelemetryInterval
        ) and self._value == other._value

    def __repr__(self) -> str:
        return f"TelemetryInterval({self._value!r})"
