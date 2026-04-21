"""
Timestream telemetry reader.

Queries the StreetlightMetrics Timestream table for time-series
telemetry data aggregated over a specified interval.

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
        query = self._build_query(
            tenant_id, streetlight_id, from_dt, to_dt, interval
        )
        try:
            return self._paginate(query)
        except (BotoCoreError, ClientError) as e:
            raise PersistenceError(
                f"Timestream query failed: {e}"
            ) from e

    def _build_query(
        self,
        tenant_id: str,
        streetlight_id: str,
        from_dt: datetime,
        to_dt: datetime,
        interval: str,
    ) -> str:
        """
        Build the Timestream query string.

        Datetime values are passed as ISO 8601 strings.

        Note: Timestream does not support named bind parameters in the
        same way as RDBMS - values are escaped manually here. The
        tenant_id and streetlight_id values are validated upstream before
        reaching this point.
        """
        # Timestream uses FROM_ISO8601_TIMESTAMP for datetime parsing
        from_str = from_dt.strftime("%Y-%m-%dT%H:%M:%S.%fZ")
        to_str = to_dt.strftime("%Y-%m-%dT%H:%M:%S.%fZ")

        # Match the multi-measure records written by TimestreamWriter.
        return (
            f"SELECT bin(time, {interval}) AS time, "
            f"AVG(lux) AS lux, "
            f"AVG(temperature) AS temp_c, "
            f"AVG(humidity) AS hum_pct, "
            f"AVG(motion) AS motion, "
            f"AVG(light_level) AS light_pct "
            f'FROM "{self._database}"."{self._table}" '
            f"WHERE measure_name = 'streetlight_telemetry' "
            f"AND tenantId = '{tenant_id}' "
            f"AND streetlightId = '{streetlight_id}' "
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
