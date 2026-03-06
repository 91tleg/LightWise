from functools import lru_cache

from libs.config import settings
from infrastructure.persistence.telemetry.base import (
    TelemetryReader, TelemetryWriter
)


_BACKEND = (settings.TELEMETRY_BACKEND or "influxdb").lower()


@lru_cache(maxsize=1)
def get_reader() -> TelemetryReader:
    if _BACKEND == "influxdb":
        from infrastructure.persistence.telemetry.influxdb.reader import (
            InfluxTelemetryReader
        )
        return InfluxTelemetryReader()

    if _BACKEND == "timestream":
        from infrastructure.persistence.telemetry.timestream.reader import (
            TimestreamTelemetryReader
        )
        return TimestreamTelemetryReader()

    raise ValueError(f"Unknown TELEMETRY_BACKEND: '{_BACKEND}'")


@lru_cache(maxsize=1)
def get_writer() -> TelemetryWriter:
    if _BACKEND == "influxdb":
        from infrastructure.persistence.telemetry.influxdb.writer import (
            InfluxTelemetryWriter
        )
        return InfluxTelemetryWriter()

    if _BACKEND == "timestream":
        from infrastructure.persistence.telemetry.timestream.writer import (
            TimestreamTelemetryWriter
        )
        return TimestreamTelemetryWriter()

    raise ValueError(f"Unknown TELEMETRY_BACKEND: '{_BACKEND}'")
