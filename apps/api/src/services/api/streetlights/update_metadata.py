import json

from application.streetlight.update_metadata import (
    get_update_metadata_service
)
from libs.logging import logger
from libs.response import success, error


_service = get_update_metadata_service()


def handler(event, context):
    streetlight_id = (
        event.get("pathParameters") or {}
    ).get("id")

    if not streetlight_id:
        return error(400, "streetlight_id is required")

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return error(400, "Invalid JSON body")

    name = body.get("name")
    lat = body.get("lat")
    lng = body.get("lng")

    if not any([name, lat, lng]):
        return error(400, "Name, lat, lng is required")

    try:
        _service.execute(
            streetlight_id=streetlight_id,
            name=name,
            lat=lat,
            lng=lng,
        )
        return success({"message": "updated"})
    except Exception:
        logger.exception(
            "Failed to update metadata for streetlight=%s",
            streetlight_id,
        )
        return error(500, "Internal server error")
