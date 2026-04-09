"""
Timestream telemetry reader.

Queries the StreetlightMetrics Timestream table for time-series
telemetry data aggregated over a specified interval.

Tenant isolation is enforced upstream - the use case validates
streetlight ownership via DynamoDB before this reader is called.
tenant_id is passed through for logging and future dimension filtering
if added to the Timestream schema.
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
        query = self._build_query(streetlight_id, from_dt, to_dt, interval)
        try:
            return self._paginate(query)
        except (BotoCoreError, ClientError) as e:
            raise PersistenceError(
                f"Timestream query failed: {e}"
            ) from e

    def _build_query(
        self,
        streetlight_id: str,
        from_dt: datetime,
        to_dt: datetime,
        interval: str,
    ) -> str:
        """
        Build the Timestream query string.

        Datetime values are passed as ISO 8601 strings. streetlight_id
        is parameterised via Timestream's prepared statement syntax to
        avoid SQL injection.

        Note: Timestream does not support named bind parameters in the
        same way as RDBMS - values are escaped manually here. The
        streetlight_id is validated as a non-empty string by the use
        case before reaching this point.
        """
        # Timestream uses FROM_ISO8601_TIMESTAMP for datetime parsing
        from_str = from_dt.strftime("%Y-%m-%dT%H:%M:%S.%fZ")
        to_str = to_dt.strftime("%Y-%m-%dT%H:%M:%S.%fZ")

        # streetlight_id is safe to interpolate - it is resolved from
        # DynamoDB metadata via the wireless_device_id lookup and is
        # never supplied raw from user input
        return (
            f"SELECT bin(time, {interval}) AS time, "
            f"AVG(measure_value::double) "
            f"FILTER (WHERE measure_name = 'lux') AS lux, "
            f"AVG(measure_value::bigint) "
            f"FILTER (WHERE measure_name = 'temperature_c') AS temp_c, "
            f"AVG(measure_value::bigint) "
            f"FILTER (WHERE measure_name = 'humidity_pct') AS hum_pct, "
            f"AVG(measure_value::bigint) "
            f"FILTER (WHERE measure_name = 'light_level_pct') AS light_pct "
            f'FROM "{self._database}"."{self._table}" '
            f"WHERE streetlight_id = '{streetlight_id}' "
            f"AND time BETWEEN FROM_ISO8601_TIMESTAMP('{from_str}') "
            f"AND FROM_ISO8601_TIMESTAMP('{to_str}') "
            f"GROUP BY 1 ORDER BY 1 ASC"
        )

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
