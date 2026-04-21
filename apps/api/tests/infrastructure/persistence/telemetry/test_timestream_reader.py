from __future__ import annotations

from datetime import datetime, timezone

from infrastructure.persistence.telemetry.timestream.reader import TimestreamReader


def _reader() -> TimestreamReader:
    reader = object.__new__(TimestreamReader)
    reader._database = "LightWiseDb"
    reader._table = "StreetlightMetrics"
    return reader


def test_build_query_matches_writer_multi_measure_schema():
    query = _reader()._build_query(
        tenant_id="tenant-001",
        streetlight_id="LW-00043",
        from_dt=datetime(2026, 4, 21, 19, 0, tzinfo=timezone.utc),
        to_dt=datetime(2026, 4, 21, 20, 0, tzinfo=timezone.utc),
        interval="1m",
    )

    assert "FROM \"LightWiseDb\".\"StreetlightMetrics\"" in query
    assert "measure_name = 'streetlight_telemetry'" in query
    assert "tenantId = 'tenant-001'" in query
    assert "streetlightId = 'LW-00043'" in query
    assert "AVG(temperature) AS temp_c" in query
    assert "AVG(humidity) AS hum_pct" in query
    assert "AVG(motion) AS motion" in query
    assert "AVG(light_level) AS light_pct" in query
