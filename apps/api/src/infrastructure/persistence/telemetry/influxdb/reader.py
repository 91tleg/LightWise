"""
InfluxDB telemetry reader.

Queries the streetlight_metrics measurement for time-series telemetry
aggregated over a specified interval.

Tenant isolation is enforced at the query level by filtering on
tenant_id as an InfluxDB tag - data from other tenants is never
returned even if streetlight_id is known.
"""

from __future__ import annotations

from datetime import datetime

from influxdb_client.client.exceptions import InfluxDBError

from infrastructure.persistence.error import PersistenceError
from infrastructure.persistence.telemetry.influxdb.client import (
    InfluxClientManager
)


class InfluxTelemetryReader:
    def __init__(self, bucket: str) -> None:
        self._bucket = bucket
        self._query_api = InfluxClientManager.get_client().query_api()

    def get_telemetry(
        self,
        tenant_id: str,
        streetlight_id: str,
        from_dt: datetime,
        to_dt: datetime,
        interval: str = "5m",
    ) -> list[dict]:
        query = self._build_query(
            tenant_id, streetlight_id, from_dt, to_dt, interval
        )
        try:
            return self._execute(query)
        except InfluxDBError as exc:
            raise PersistenceError(
                f"InfluxDB query failed for streetlight {
                    streetlight_id
                }: {exc}"
            ) from exc

    def _build_query(
        self,
        tenant_id: str,
        streetlight_id: str,
        from_dt: datetime,
        to_dt: datetime,
        interval: str,
    ) -> str:
        from_str = from_dt.strftime("%Y-%m-%dT%H:%M:%SZ")
        to_str = to_dt.strftime("%Y-%m-%dT%H:%M:%SZ")

        # tenant_id and streetlight_id are resolved from DynamoDB metadata
        # and are never supplied raw from user input - safe to interpolate.
        # InfluxDB Flux does not support bind parameters.
        return f"""
            from(bucket: "{self._bucket}")
              |> range(start: {from_str}, stop: {to_str})
              |> filter(fn: (r) => r._measurement == "streetlight_metrics")
              |> filter(fn: (r) => r.tenant_id == "{tenant_id}")
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
              |> drop(columns: ["_start", "_stop", "_measurement"])
              |> sort(columns: ["_time"])
        """

    def _execute(self, query: str) -> list[dict]:
        """
        Execute a Flux query and close the stream when done.

        query_stream returns a generator backed by an HTTP connection.
        The generator must be closed after iteration to avoid leaking
        connections under load.
        """
        generator = self._query_api.query_stream(query)
        try:
            return [
                {
                    "time": record.get_time().isoformat(),
                    "lux": record.values.get("lux"),
                    "temperature_c": record.values.get("temperature_c"),
                    "humidity_pct": record.values.get("humidity_pct"),
                    "light_level_pct": record.values.get("light_level_pct"),
                }
                for record in generator
            ]
        finally:
            generator.close()
