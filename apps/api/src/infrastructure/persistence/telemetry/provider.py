"""
Telemetry backend provider.

Selects the telemetry reader and writer based on the
TELEMETRY_BACKEND environment variable.

Supported backends:
  influxdb   - InfluxDB
  timestream - Amazon Timestream
"""

from __future__ import annotations
from functools import lru_cache

from libs.config import settings


@lru_cache(maxsize=1)
def get_reader():
    """
    Return the configured telemetry reader.

    Return type is intentionally untyped here - callers depend on the
    TelemetryReader Protocol.
    """
    backend = _backend()

    if backend == "influxdb":
        from infrastructure.persistence.telemetry.influxdb.reader import (
            InfluxTelemetryReader,
        )
        return InfluxTelemetryReader(bucket=settings.INFLUX_BUCKET)

    if backend == "timestream":
        from infrastructure.persistence.telemetry.timestream.reader import (
            TimestreamReader,
        )
        return TimestreamReader(
            database=settings.TS_DATABASE,
            table=settings.TS_TABLE,
        )

    raise ValueError(f"Unknown TELEMETRY_BACKEND: '{backend}'")


@lru_cache(maxsize=1)
def get_writer():
    """
    Return the configured telemetry writer.

    Return type is intentionally untyped here - callers depend on the
    TelemetryWriter Protocol.
    """
    backend = _backend()

    if backend == "influxdb":
        from infrastructure.persistence.telemetry.influxdb.writer import (
            InfluxTelemetryWriter,
        )
        return InfluxTelemetryWriter(bucket=settings.INFLUX_BUCKET)

    if backend == "timestream":
        from infrastructure.persistence.telemetry.timestream.writer import (
            TimestreamWriter,
        )
        return TimestreamWriter(
            database=settings.TS_DATABASE,
            table=settings.TS_TABLE,
        )

    raise ValueError(f"Unknown TELEMETRY_BACKEND: '{backend}'")


def _backend() -> str:
    return (settings.TELEMETRY_BACKEND or "influxdb").lower()
