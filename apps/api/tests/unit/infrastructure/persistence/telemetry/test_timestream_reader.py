from __future__ import annotations

from datetime import datetime, timezone

from infrastructure.persistence.telemetry.timestream.reader import (
    TimestreamReader,
)


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
    assert "SUM(motion) AS motion_count" in query
    assert "COUNT(motion) AS motion_samples" in query
    assert "AVG(light_level) AS light_pct" in query


def test_build_queries_includes_legacy_single_measure_schema():
    queries = _reader()._build_queries(
        tenant_id="tenant-001",
        streetlight_id="LW-00043",
        from_dt=datetime(2026, 4, 21, 19, 0, tzinfo=timezone.utc),
        to_dt=datetime(2026, 4, 21, 20, 0, tzinfo=timezone.utc),
        interval="1m",
    )

    assert len(queries) == 4
    assert any("tenantId = 'tenant-001'" in query for query in queries)
    assert any("tenant_id = 'tenant-001'" in query for query in queries)
    assert any("streetlight_id = 'LW-00043'" in query for query in queries)
    assert any("measure_value::double" in query for query in queries)
    assert any("temperature_c" in query for query in queries)
    assert any("light_level_pct" in query for query in queries)
    assert any("motion_count" in query for query in queries)
    assert any("motion_samples" in query for query in queries)


def test_merge_rows_combines_legacy_and_multi_measure_buckets():
    rows = [
        {
            "time": "2026-04-21T19:00:00Z",
            "lux": "91.2",
            "temp_c": None,
        },
        {
            "time": "2026-04-21T19:00:00Z",
            "temp_c": "18",
            "motion": "1",
            "motion_count": "3",
            "motion_samples": "8",
        },
        {
            "time": "2026-04-21T19:01:00Z",
            "lux": "88.1",
        },
    ]

    assert TimestreamReader._merge_rows(rows) == [
        {
            "time": "2026-04-21T19:00:00Z",
            "lux": "91.2",
            "temp_c": "18",
            "motion": "1",
            "motion_count": "3",
            "motion_samples": "8",
        },
        {
            "time": "2026-04-21T19:01:00Z",
            "lux": "88.1",
        },
    ]
