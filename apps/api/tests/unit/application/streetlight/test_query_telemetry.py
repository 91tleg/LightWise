from __future__ import annotations
from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock

from application.streetlight.query_telemetry import QueryTelemetry
from domain.streetlight.interval import TelemetryInterval


_NOW = datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc)


def _use_case(
    data: list[dict] | None = None
) -> tuple[QueryTelemetry, MagicMock]:
    reader = MagicMock()
    reader.get_telemetry.return_value = data or []
    return QueryTelemetry(reader=reader), reader


def _window(hours: int = 1) -> tuple[datetime, datetime]:
    return _NOW, _NOW + timedelta(hours=hours)


class TestDelegation:
    def test_returns_reader_data(self):
        rows = [{"time": "2024-01-01T12:00:00Z", "lux": 123.4, "motion": 3}]
        use_case, _ = _use_case(data=rows)
        from_dt, to_dt = _window(hours=1)
        result = use_case.execute(
            tenant_id="tenant-1",
            streetlight_id="sl-001",
            from_dt=from_dt,
            to_dt=to_dt,
            interval=TelemetryInterval("5m"),
        )
        assert result["rows"] == rows

    def test_reader_called_with_correct_args(self):
        use_case, reader = _use_case()
        from_dt, to_dt = _window(hours=1)
        use_case.execute(
            tenant_id="tenant-1",
            streetlight_id="sl-001",
            from_dt=from_dt,
            to_dt=to_dt,
            interval=TelemetryInterval("5m"),
        )
        reader.get_telemetry.assert_called_once_with(
            tenant_id="tenant-1",
            streetlight_id="sl-001",
            from_dt=from_dt,
            to_dt=to_dt,
            interval="5m",
        )

    def test_returns_empty_rows_and_zero_motion_when_no_data(self):
        use_case, _ = _use_case(data=[])
        from_dt, to_dt = _window()
        result = use_case.execute(
            tenant_id="tenant-1",
            streetlight_id="sl-001",
            from_dt=from_dt,
            to_dt=to_dt,
            interval=TelemetryInterval("5m"),
        )
        assert result == {"rows": [], "motion_total": 0}


class TestMotionTotal:
    def test_sums_motion_across_rows(self):
        rows = [
            {"time": "2024-01-01T00:00:00Z", "motion": 10},
            {"time": "2024-01-02T00:00:00Z", "motion": 25},
            {"time": "2024-01-03T00:00:00Z", "motion": 7},
        ]
        use_case, _ = _use_case(data=rows)
        from_dt, to_dt = _window(hours=72)
        result = use_case.execute(
            tenant_id="tenant-1",
            streetlight_id="sl-001",
            from_dt=from_dt,
            to_dt=to_dt,
            interval=TelemetryInterval("1d"),
        )
        assert result["motion_total"] == 42

    def test_motion_total_zero_when_all_null(self):
        rows = [
            {"time": "2024-01-01T00:00:00Z", "motion": None},
            {"time": "2024-01-02T00:00:00Z", "motion": None},
        ]
        use_case, _ = _use_case(data=rows)
        from_dt, to_dt = _window(hours=48)
        result = use_case.execute(
            tenant_id="tenant-1",
            streetlight_id="sl-001",
            from_dt=from_dt,
            to_dt=to_dt,
            interval=TelemetryInterval("1d"),
        )
        assert result["motion_total"] == 0

    def test_motion_total_skips_null_rows(self):
        rows = [
            {"time": "2024-01-01T00:00:00Z", "motion": 5},
            {"time": "2024-01-02T00:00:00Z", "motion": None},
            {"time": "2024-01-03T00:00:00Z", "motion": 8},
        ]
        use_case, _ = _use_case(data=rows)
        from_dt, to_dt = _window(hours=72)
        result = use_case.execute(
            tenant_id="tenant-1",
            streetlight_id="sl-001",
            from_dt=from_dt,
            to_dt=to_dt,
            interval=TelemetryInterval("1d"),
        )
        assert result["motion_total"] == 13


class TestIntervalResolution:
    def test_short_window_preserves_fine_interval(self):
        """1h window - 1m interval should be preserved."""
        use_case, reader = _use_case()
        from_dt, to_dt = _window(hours=1)
        use_case.execute(
            tenant_id="tenant-1",
            streetlight_id="sl-001",
            from_dt=from_dt,
            to_dt=to_dt,
            interval=TelemetryInterval("1m"),
        )
        _, kwargs = reader.get_telemetry.call_args
        assert kwargs["interval"] == "1m"

    def test_large_window_coerces_fine_interval(self):
        """30d window - 1m interval should be coerced to 1d."""
        use_case, reader = _use_case()
        from_dt = _NOW
        to_dt = _NOW + timedelta(days=30)
        use_case.execute(
            tenant_id="tenant-1",
            streetlight_id="sl-001",
            from_dt=from_dt,
            to_dt=to_dt,
            interval=TelemetryInterval("1m"),
        )
        _, kwargs = reader.get_telemetry.call_args
        assert kwargs["interval"] == "1d"

    def test_7d_window_coerces_1m_to_1h(self):
        use_case, reader = _use_case()
        from_dt = _NOW
        to_dt = _NOW + timedelta(days=7)
        use_case.execute(
            tenant_id="tenant-1",
            streetlight_id="sl-001",
            from_dt=from_dt,
            to_dt=to_dt,
            interval=TelemetryInterval("1m"),
        )
        _, kwargs = reader.get_telemetry.call_args
        assert kwargs["interval"] == "1h"

    def test_already_coarse_interval_preserved(self):
        """30d window with 1d interval - no coercion."""
        use_case, reader = _use_case()
        from_dt = _NOW
        to_dt = _NOW + timedelta(days=30)
        use_case.execute(
            tenant_id="tenant-1",
            streetlight_id="sl-001",
            from_dt=from_dt,
            to_dt=to_dt,
            interval=TelemetryInterval("1d"),
        )
        _, kwargs = reader.get_telemetry.call_args
        assert kwargs["interval"] == "1d"


class TestTenantScoping:
    def test_tenant_id_passed_to_reader(self):
        use_case, reader = _use_case()
        from_dt, to_dt = _window()
        use_case.execute(
            tenant_id="tenant-abc",
            streetlight_id="sl-001",
            from_dt=from_dt,
            to_dt=to_dt,
            interval=TelemetryInterval("5m"),
        )
        _, kwargs = reader.get_telemetry.call_args
        assert kwargs["tenant_id"] == "tenant-abc"
