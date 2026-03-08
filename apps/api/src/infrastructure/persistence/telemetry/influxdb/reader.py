from datetime import datetime

from infrastructure.persistence.error import PersistenceError
from infrastructure.persistence.telemetry.base import TelemetryReader
from infrastructure.persistence.telemetry.influxdb.client import (
    InfluxClientManager
)
from libs.config import settings


class InfluxTelemetryReader(TelemetryReader):
    def __init__(self, bucket: str = settings.INFLUX_BUCKET):
        self.bucket = bucket
        self._query_api = InfluxClientManager.get_client().query_api()

    def get_telemetry(
        self,
        streetlight_id: str,
        from_dt: datetime,
        to_dt: datetime,
        interval: str = "1h",
    ) -> list[dict]:
        from_str = from_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        to_str = to_dt.strftime("%Y-%m-%dT%H:%M:%SZ")

        flux = f"""
            from(bucket: "{self.bucket}")
              |> range(start: {from_str}, stop: {to_str})
              |> filter(fn: (r) => r._measurement == "streetlight_metrics")
              |> filter(fn: (r) => r.streetlight_id == "{streetlight_id}")
              |> filter(fn: (r) =>
                    r._field == "lux"             or
                    r._field == "temperature_c"   or
                    r._field == "humidity_pct"    or
                    r._field == "light_level_pct"
              )
              |> aggregateWindow(
                    every: {interval},
                    fn: mean,
                    createEmpty: false
              )
              |> pivot(
                    rowKey: ["_time"],
                    columnKey: ["_field"],
                    valueColumn: "_value"
              )
              |> keep(columns: [
                    "_time", "lux", "temperature_c",
                    "humidity_pct", "light_level_pct"
              ])
              |> sort(columns: ["_time"], desc: false)
        """

        try:
            tables = self._query_api.query(flux)
        except Exception as e:
            raise PersistenceError(f"InfluxDB query failed: {e}") from e

        results = []
        for table in tables:
            for record in table.records:
                results.append({
                    "time": record.get_time().isoformat(),
                    "lux": record.values.get("lux"),
                    "temperature_c": record.values.get("temperature_c"),
                    "humidity_pct": record.values.get("humidity_pct"),
                    "light_level_pct": record.values.get("light_level_pct"),
                })
        return results
