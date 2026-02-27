from datetime import datetime
from functools import lru_cache

from infrastructure.persistence.timestream.reader import (
    TimestreamReader
)


class GetStreetlightTelemetry:
    def __init__(self, reader: TimestreamReader):
        self.reader = reader

    def execute(
        self,
        streetlight_id: str,
        from_dt: datetime,
        to_dt: datetime,
        interval: str,
    ) -> list[dict]:
        return self.reader.get_telemetry(
            streetlight_id=streetlight_id,
            from_dt=from_dt,
            to_dt=to_dt,
            interval=interval,
        )


@lru_cache(maxsize=1)
def get_telemetry_service() -> GetStreetlightTelemetry:
    return GetStreetlightTelemetry(reader=TimestreamReader())
