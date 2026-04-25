"""
Timestream telemetry reader.

Queries the StreetlightMetrics Timestream table for time-series
telemetry data aggregated over a specified interval. The reader supports
both the current multi-measure schema and legacy single-measure rows so
older report ranges continue to populate.

Tenant isolation is enforced upstream and in the Timestream query using
the tenantId dimension written with each telemetry record.
"""

from __future__ import annotations
from datetime import datetime

from botocore.exceptions import BotoCoreError, ClientError

from infrastructure.persistence.error import PersistenceError
from infrastructure.persistence.telemetry.timestream.client import (
    TimestreamClientManager,
)


class TimestreamReader:
    def __init__(
        self,
        database: str,
        table: str,
    ) -> None:
        self._database = database
        self._table = table
        self._client = TimestreamClientManager.get_query_client()

    def get_telemetry(
        self,
        tenant_id: str,
        streetlight_id: str,
        from_dt: datetime,
        to_dt: datetime,
        interval: str = "5m",
    ) -> list[dict]:
        rows: list[dict] = []
        errors: list[Exception] = []

        queries = self._build_queries(
            tenant_id, streetlight_id, from_dt, to_dt, interval
        )

        for query in queries:
            try:
                rows.extend(self._paginate(query))
            except (BotoCoreError, ClientError) as e:
                errors.append(e)

        if rows:
            return self._merge_rows(rows)

        if errors and len(errors) == len(queries):
            raise PersistenceError(
                f"Timestream query failed: {errors[-1]}"
            ) from errors[-1]

        return []

    def _build_queries(
        self,
        tenant_id: str,
        streetlight_id: str,
        from_dt: datetime,
        to_dt: datetime,
        interval: str,
    ) -> list[str]:
        return [
            self._build_multi_measure_query(
                tenant_id=tenant_id,
                streetlight_id=streetlight_id,
                from_dt=from_dt,
                to_dt=to_dt,
                interval=interval,
                tenant_column="tenantId",
                streetlight_column="streetlightId",
            ),
            self._build_multi_measure_query(
                tenant_id=tenant_id,
                streetlight_id=streetlight_id,
                from_dt=from_dt,
                to_dt=to_dt,
                interval=interval,
                tenant_column="tenant_id",
                streetlight_column="streetlight_id",
            ),
            self._build_legacy_single_measure_query(
                tenant_id=tenant_id,
                streetlight_id=streetlight_id,
                from_dt=from_dt,
                to_dt=to_dt,
                interval=interval,
                tenant_column="tenant_id",
            ),
            self._build_legacy_single_measure_query(
                tenant_id=None,
                streetlight_id=streetlight_id,
                from_dt=from_dt,
                to_dt=to_dt,
                interval=interval,
                tenant_column=None,
            ),
        ]

    def _build_query(
        self,
        tenant_id: str,
        streetlight_id: str,
        from_dt: datetime,
        to_dt: datetime,
        interval: str,
    ) -> str:
        return self._build_multi_measure_query(
            tenant_id=tenant_id,
            streetlight_id=streetlight_id,
            from_dt=from_dt,
            to_dt=to_dt,
            interval=interval,
            tenant_column="tenantId",
            streetlight_column="streetlightId",
        )

    def _build_multi_measure_query(
        self,
        tenant_id: str,
        streetlight_id: str,
        from_dt: datetime,
        to_dt: datetime,
        interval: str,
        tenant_column: str,
        streetlight_column: str,
    ) -> str:
        from_str, to_str = self._format_window(from_dt, to_dt)

        return (
            f"SELECT bin(time, {interval}) AS time, "
            f"AVG(lux) AS lux, "
            f"AVG(temperature) AS temp_c, "
            f"AVG(humidity) AS hum_pct, "
            f"AVG(motion) AS motion, "
            f"AVG(light_level) AS light_pct "
            f'FROM "{self._database}"."{self._table}" '
            f"WHERE measure_name = 'streetlight_telemetry' "
            f"AND {tenant_column} = '{tenant_id}' "
            f"AND {streetlight_column} = '{streetlight_id}' "
            f"AND time BETWEEN FROM_ISO8601_TIMESTAMP('{from_str}') "
            f"AND FROM_ISO8601_TIMESTAMP('{to_str}') "
            f"GROUP BY 1 ORDER BY 1 ASC"
        )

    def _build_legacy_single_measure_query(
        self,
        tenant_id: str | None,
        streetlight_id: str,
        from_dt: datetime,
        to_dt: datetime,
        interval: str,
        tenant_column: str | None,
    ) -> str:
        from_str, to_str = self._format_window(from_dt, to_dt)
        tenant_clause = (
            f"AND {tenant_column} = '{tenant_id}' "
            if tenant_id and tenant_column
            else ""
        )

        return (
            f"SELECT bin(time, {interval}) AS time, "
            f"AVG(measure_value::double) "
            f"FILTER (WHERE measure_name = 'lux') AS lux, "
            f"AVG(measure_value::bigint) "
            f"FILTER ("
            f"WHERE measure_name IN ('temperature', 'temperature_c')"
            f") AS temp_c, "
            f"AVG(measure_value::bigint) "
            f"FILTER ("
            f"WHERE measure_name IN ('humidity', 'humidity_pct')"
            f") AS hum_pct, "
            f"AVG(measure_value::bigint) "
            f"FILTER (WHERE measure_name = 'motion') AS motion, "
            f"AVG(measure_value::bigint) "
            f"FILTER ("
            f"WHERE measure_name IN ('light_level', 'light_level_pct')"
            f") AS light_pct "
            f'FROM "{self._database}"."{self._table}" '
            f"WHERE streetlight_id = '{streetlight_id}' "
            f"{tenant_clause}"
            f"AND time BETWEEN FROM_ISO8601_TIMESTAMP('{from_str}') "
            f"AND FROM_ISO8601_TIMESTAMP('{to_str}') "
            f"AND measure_name IN ("
            f"'lux', 'temperature', 'temperature_c', 'humidity', "
            f"'humidity_pct', 'motion', 'light_level', 'light_level_pct'"
            f") "
            f"GROUP BY 1 ORDER BY 1 ASC"
        )

    @staticmethod
    def _format_window(from_dt: datetime, to_dt: datetime) -> tuple[str, str]:
        return (
            from_dt.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
            to_dt.strftime("%Y-%m-%dT%H:%M:%S.%fZ"),
        )

    @staticmethod
    def _merge_rows(rows: list[dict]) -> list[dict]:
        buckets: dict[str, dict] = {}

        for row in rows:
            timestamp = row.get("time")
            if not timestamp:
                continue

            current = buckets.setdefault(timestamp, {"time": timestamp})
            for key, value in row.items():
                if key == "time" or value is None:
                    continue
                current[key] = value

        return [buckets[key] for key in sorted(buckets)]

    def _paginate(self, query: str) -> list[dict]:
        """
        Execute a query and collect all pages.

        Timestream returns a NextToken when results exceed the page size.
        All pages are collected before returning.
        """
        results = []
        next_token = None

        while True:
            kwargs: dict = {"QueryString": query}
            if next_token:
                kwargs["NextToken"] = next_token

            response = self._client.query(**kwargs)
            results.extend(self._parse_page(response))

            next_token = response.get("NextToken")
            if not next_token:
                break

        return results

    @staticmethod
    def _parse_page(response: dict) -> list[dict]:
        columns = [col["Name"] for col in response["ColumnInfo"]]
        rows = []
        for row in response["Rows"]:
            values = [datum.get("ScalarValue") for datum in row["Data"]]
            rows.append(dict(zip(columns, values)))
        return rows
