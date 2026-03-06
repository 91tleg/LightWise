from datetime import datetime
from botocore.exceptions import BotoCoreError, ClientError
from .client import TimestreamClientManager
from infrastructure.persistence.error import PersistenceError
from libs.config import settings


class TimestreamReader:
    def __init__(
        self,
        database: str = settings.TS_DATABASE,
        table: str = settings.TS_TABLE,
    ):
        self.database = database
        self.table = table
        self.client = TimestreamClientManager.get_query_client()

    def get_telemetry(
        self,
        streetlight_id: str,
        from_dt: datetime,
        to_dt: datetime,
        interval: str = "1m",
    ) -> list[dict]:
        if not self.database or not self.table:
            return []

        from_dt_str = from_dt.isoformat()
        to_dt_str = to_dt.isoformat()
        query = f"""
            SELECT
                bin(time, {interval}) AS time,
                AVG(lux) AS lux,
                AVG(temperature) AS temperature_c,
                AVG(humidity) AS humidity_pct,
                AVG(light_level) AS light_level_pct
            FROM "{self.database}"."{self.table}"
            WHERE streetlightId = '{streetlight_id}'
              AND time BETWEEN '{from_dt_str}' AND '{to_dt_str}'
            GROUP BY bin(time, {interval})
            ORDER BY bin(time, {interval}) ASC
        """

        try:
            response = self.client.query(QueryString=query)
            return self._parse(response)
        except (BotoCoreError, ClientError) as e:
            raise PersistenceError(f"Timestream query failed: {e}") from e

    def _parse(self, response: dict) -> list[dict]:
        columns = [c["Name"] for c in response["ColumnInfo"]]
        results = []
        for row in response["Rows"]:
            values = [v.get("ScalarValue") for v in row["Data"]]
            results.append(dict(zip(columns, values)))
        return results
