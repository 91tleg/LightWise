import json
from datetime import datetime

from application.streetlight.get_telemetry import get_telemetry_service
from libs.logging import logger


_service = get_telemetry_service()

VALID_INTERVALS = {"1m", "5m", "15m", "1h", "1d"}


def handler(event, context):
    streetlight_id = (
        event.get("pathParameters") or {}
    ).get("id")

    if not streetlight_id:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "streetlight_id is required"}),
        }

    params = event.get("queryStringParameters") or {}
    from_str = params.get("from")
    to_str = params.get("to")
    interval = params.get("interval", "5m")

    if not from_str or not to_str:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "from and to are required"}),
        }

    if interval not in VALID_INTERVALS:
        return {
            "statusCode": 400,
            "body": json.dumps({
                "error": f"interval must be one of {VALID_INTERVALS}"
            }),
        }

    try:
        from_dt = datetime.fromisoformat(from_str)
        to_dt = datetime.fromisoformat(to_str)
    except ValueError:
        return {
            "statusCode": 400,
            "body": json.dumps(
                {
                    "error": "from and to must be ISO 8601 format"
                }
            ),
        }

    if from_dt >= to_dt:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "from must be before to"}),
        }

    try:
        data = _service.execute(
            streetlight_id=streetlight_id,
            from_dt=from_dt,
            to_dt=to_dt,
            interval=interval,
        )
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps(
                {
                    "streetlight_id": streetlight_id, "data": data
                }
            ),
        }
    except Exception:
        logger.exception(
            "Failed to get telemetry for streetlight=%s", streetlight_id
        )
        return {
            "statusCode": 500,
            "body": json.dumps({"error": "Internal server error"}),
        }
