import json

from application.streetlight.update_metadata import (
    get_update_metadata_service
)
from libs.logging import logger


_service = get_update_metadata_service()


def handler(event, context):
    streetlight_id = (
        event.get("pathParameters") or {}
    ).get("id")

    if not streetlight_id:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "streetlight_id is required"}),
        }

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "Invalid JSON body"}),
        }

    name = body.get("name")
    lat = body.get("lat")
    lng = body.get("lng")

    if not any([name, lat, lng]):
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "Name, lat, lng is required"}),
        }

    try:
        _service.execute(
            streetlight_id=streetlight_id,
            name=name,
            lat=lat,
            lng=lng,
        )
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps({"message": "updated"}),
        }
    except Exception:
        logger.exception(
            "Failed to update metadata for streetlight=%s",
            streetlight_id,
        )
        import traceback
        print("TRACEBACK:", traceback.format_exc())
        return {
            "statusCode": 500,
            "body": json.dumps({"error": "Internal server error"}),
        }
