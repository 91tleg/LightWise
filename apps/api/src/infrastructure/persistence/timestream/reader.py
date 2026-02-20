from datetime import datetime
from typing import List, Dict
from .client import get_query_client
from libs.config import settings

def query_records(
    device_id: str,
    start_time: datetime,
    end_time: datetime,
    limit: int = 100,
) -> List[Dict]:
    client = get_query_client()

    query_string = f"""
        SELECT *
        FROM "{settings.TS_DATABASE}"."{settings.TS_TABLE}"
        WHERE device_id = '{device_id}'
        AND time BETWEEN '{start_time.isoformat()}' AND '{end_time.isoformat()}'
        ORDER BY time ASC
        LIMIT {limit}
    """

    try:
        response = client.query(QueryString=query_string)
        rows = response.get("Rows", [])
        result = []
        for row in rows:
            record = {}
            for i, datum in enumerate(row["Data"]):
                record_key = response["ColumnInfo"][i]["Name"]
                if "ScalarValue" in datum:
                    record[record_key] = datum["ScalarValue"]
            result.append(record)
        return result
    except Exception:
        return []
