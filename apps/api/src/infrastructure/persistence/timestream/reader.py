from datetime import datetime, timezone
from typing import List, Dict
from .client import TimestreamClientManager
from libs.config import settings
from libs.logging import logger


def query_records(
    streetlight_id: str,
    start_time: datetime,
    end_time: datetime,
    limit: int = 100,
) -> List[Dict]:
    client = TimestreamClientManager.get_query_client()

    # Ensure UTC ISO8601 with Z
    start_time_str = start_time \
        .astimezone(timezone.utc) \
        .strftime("%Y-%m-%dT%H:%M:%SZ")

    end_time_str = end_time \
        .astimezone(timezone.utc) \
        .strftime("%Y-%m-%dT%H:%M:%SZ")

    query_string = (
        f'SELECT * '
        f'FROM "{settings.TS_DATABASE}"."{settings.TS_TABLE}" '
        f"WHERE streetlight_id = '{streetlight_id}' "
        f"AND time BETWEEN '{start_time_str}' AND '{end_time_str}' "
        f"ORDER BY time ASC "
        f"LIMIT {limit}"
    )

    try:
        response = client.query(QueryString=query_string)
        rows = response.get("Rows", [])
        columns = response.get("ColumnInfo", [])

        result = []
        for row in rows:
            record = {}
            for i, datum in enumerate(row["Data"]):
                col_name = columns[i]["Name"]
                if "ScalarValue" in datum:
                    record[col_name] = datum["ScalarValue"]
                else:
                    record[col_name] = None
            result.append(record)
        return result

    except Exception as e:
        logger.exception(f"Timestream query failed: {e}")
        return []
