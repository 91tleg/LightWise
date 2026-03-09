from datetime import datetime, timedelta, timezone
from unittest.mock import MagicMock
import pytest

from application.telemetry.query_telemetry import (
    QueryTelemetry,
    resolve_interval,
    _interval_to_minutes,
)


@pytest.fixture
def mock_reader():
    return MagicMock()


@pytest.fixture
def service(mock_reader):
    return QueryTelemetry(reader=mock_reader)


def dt(days_ago: int = 0, hours_ago: int = 0) -> datetime:
    return datetime.now(tz=timezone.utc) - timedelta(
        days=days_ago, hours=hours_ago
    )


class TestIntervalToMinutes:
    def test_minutes(self):
        assert _interval_to_minutes("1m") == 1
        assert _interval_to_minutes("5m") == 5
        assert _interval_to_minutes("30m") == 30

    def test_hours(self):
        assert _interval_to_minutes("1h") == 60
        assert _interval_to_minutes("6h") == 360
        assert _interval_to_minutes("12h") == 720

    def test_days(self):
        assert _interval_to_minutes("1d") == 1440
        assert _interval_to_minutes("7d") == 10080
        assert _interval_to_minutes("30d") == 43200


class TestResolveInterval:
    def test_30_day_range_enforces_1d(self):
        assert resolve_interval(dt(days_ago=30), dt(), "1h") == "1d"

    def test_30_day_range_keeps_coarser_interval(self):
        assert resolve_interval(dt(days_ago=30), dt(), "7d") == "7d"

    def test_30_day_range_keeps_1d(self):
        assert resolve_interval(dt(days_ago=30), dt(), "1d") == "1d"

    def test_7_day_range_enforces_1h(self):
        assert resolve_interval(dt(days_ago=7), dt(), "5m") == "1h"

    def test_7_day_range_keeps_coarser_interval(self):
        assert resolve_interval(dt(days_ago=7), dt(), "6h") == "6h"

    def test_7_day_range_keeps_1h(self):
        assert resolve_interval(dt(days_ago=7), dt(), "1h") == "1h"

    def test_24_hour_range_enforces_5m(self):
        assert resolve_interval(dt(hours_ago=24), dt(), "1m") == "5m"

    def test_24_hour_range_keeps_coarser_interval(self):
        assert resolve_interval(dt(hours_ago=24), dt(), "1h") == "1h"

    def test_24_hour_range_keeps_5m(self):
        assert resolve_interval(dt(hours_ago=24), dt(), "5m") == "5m"

    def test_1_hour_range_keeps_1m(self):
        assert resolve_interval(dt(hours_ago=1), dt(), "1m") == "1m"

    def test_short_range_keeps_requested_interval(self):
        assert resolve_interval(dt(hours_ago=0), dt(), "1m") == "1m"


class TestQueryTelemetryExecute:
    def test_calls_reader_with_correct_args(
        self, service, mock_reader
    ):
        from_dt = dt(hours_ago=1)
        to_dt = dt()
        mock_reader.get_telemetry.return_value = []

        service.execute("LW-00001", from_dt, to_dt, "1m")

        mock_reader.get_telemetry.assert_called_once_with(
            streetlight_id="LW-00001",
            from_dt=from_dt,
            to_dt=to_dt,
            interval="1m",
        )

    def test_returns_reader_results(self, service, mock_reader):
        rows = [{"time": "2026-01-01T00:00:00Z", "lux": 134.2}]
        mock_reader.get_telemetry.return_value = rows

        data = service.execute("LW-00001", dt(hours_ago=1), dt(), "1m")

        assert data == rows

    def test_resolves_interval_before_calling_reader(
        self, service, mock_reader
    ):
        mock_reader.get_telemetry.return_value = []

        service.execute("LW-00001", dt(days_ago=30), dt(), "1m")

        call_kwargs = mock_reader.get_telemetry.call_args.kwargs
        assert call_kwargs["interval"] == "1d"

    def test_default_interval_is_1h(
        self, service, mock_reader
    ):
        mock_reader.get_telemetry.return_value = []

        service.execute("LW-00001", dt(hours_ago=1), dt())

        call_kwargs = mock_reader.get_telemetry.call_args.kwargs
        assert call_kwargs["interval"] == "1h"
