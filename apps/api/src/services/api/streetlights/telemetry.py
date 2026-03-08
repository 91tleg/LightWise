from datetime import datetime

from application.telemetry.query_telemetry import get_query_telemetry
from libs.logging import logger
from libs.response import success, error


_service = get_query_telemetry()


_ALLOWED_INTERVALS = {
    "1m", "5m", "10m", "15m", "30m",   # short term
    "1h", "6h", "12h",                 # medium term
    "1d", "7d", "30d",                 # energy trend analysis
}


def handler(event, context):
    streetlight_id = (
        event.get("pathParameters") or {}
    ).get("id")

    if not streetlight_id:
        return error(400, "streetlight_id is required")

    params = event.get("queryStringParameters") or {}
    from_str = params.get("from")
    to_str = params.get("to")
    interval = params.get("interval", "5m")

    if not from_str or not to_str:
        return error(400, "from and to are required")

    if interval not in _ALLOWED_INTERVALS:
       return error(400, f"interval must be one of {_ALLOWED_INTERVALS}")

    try:
        from_dt = datetime.fromisoformat(from_str)
        to_dt = datetime.fromisoformat(to_str)
    except ValueError:
        return error(400, "from and to must be ISO 8601 format")

    if from_dt >= to_dt:
        return error(400, "from must be before to")

    try:
        data = _service.execute(
            streetlight_id=streetlight_id,
            from_dt=from_dt,
            to_dt=to_dt,
            interval=interval,
        )
        return success({"streetlight_id": streetlight_id, "data": data})
    except Exception:
        logger.exception(
            "Failed to get telemetry for streetlight=%s", streetlight_id
        )
        return error(500, "Internal server error")
