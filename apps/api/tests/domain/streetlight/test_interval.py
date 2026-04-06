import pytest
from datetime import datetime, timedelta
from domain.streetlight.interval import TelemetryInterval


class TestTelemetryInterval:
    def test_init_valid_values(self):
        intervals = ["1m", "5m", "1h", "1d", "30d"]
        for val in intervals:
            interval = TelemetryInterval(val)
            assert interval.value == val

    def test_init_invalid_value_raises_error(self):
        with pytest.raises(ValueError, match="Invalid interval '2m'"):
            TelemetryInterval("2m")

    def test_default_factory(self):
        interval = TelemetryInterval.default()
        assert interval.value == "5m"
        assert isinstance(interval, TelemetryInterval)

    def test_equality(self):
        assert TelemetryInterval("1m") == TelemetryInterval("1m")
        assert TelemetryInterval("1m") != TelemetryInterval("5m")
        assert TelemetryInterval("1m") != "1m"

    @pytest.mark.parametrize("window_days, requested, expected", [
        # Window >= 30 days -> Min 1d
        (31, "1m", "1d"),
        (30, "1h", "1d"),
        (35, "30d", "30d"),  # Requested is coarser than min, keep

        # Window >= 7 days -> Min 1h
        (8, "1m", "1h"),
        (7, "5m", "1h"),
        (7, "1d", "1d"),     # Requested is coarser than min, keep

        # Window >= 24 hours -> Min 5m
        (1, "1m", "5m"),
        (2, "10m", "10m"),   # Requested is coarser than min, keep

        # Window >= 1 hour -> Min 1m
        (0.05, "1m", "1m"),  # ~72 mins: 1m is allowed

        # Tiny window (under 1h) -> No coercion
        (0.01, "1m", "1m"),
    ])
    def test_resolve_for_window(self, window_days, requested, expected):
        from_dt = datetime(2024, 1, 1, 12, 0)
        to_dt = from_dt + timedelta(days=window_days)

        interval = TelemetryInterval(requested)
        resolved = interval.resolve_for_window(from_dt, to_dt)

        assert resolved.value == expected
        assert isinstance(resolved, TelemetryInterval)

    def test_repr(self):
        interval = TelemetryInterval("15m")
        assert repr(interval) == "TelemetryInterval('15m')"
