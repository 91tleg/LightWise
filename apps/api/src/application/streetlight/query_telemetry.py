"""
QueryTelemetry application use case.

Queries time-series telemetry for a streetlight over a given window.
"""

from __future__ import annotations
from datetime import datetime
from typing import Protocol


class TelemetryReader(Protocol):
    def get_telemetry(
        self,
        tenant_id: str,
        streetlight_id: str,
        from_dt: datetime,
        to_dt: datetime,
        interval: str,
    ) -> list[dict]: ...


class QueryTelemetry:
    def __init__(self, reader: TelemetryReader) -> None:
        self._reader = reader

    def execute(
        self, tenant_id, streetlight_id, from_dt, to_dt, interval
    ):
        resolved = interval.resolve_for_window(from_dt, to_dt)
        rows = self._reader.get_telemetry(
            tenant_id=tenant_id,
            streetlight_id=streetlight_id,
            from_dt=from_dt,
            to_dt=to_dt,
            interval=resolved.value,
        )
        motion_total = sum(r["motion"] or 0 for r in rows)
        return {"rows": rows, "motion_total": motion_total}
