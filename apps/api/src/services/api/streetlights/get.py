from application.streetlight.get_streetlight import (
    get_streetlight_service
)
from libs.logging import logger
from libs.response import success, error


_service = get_streetlight_service()


def handler(event, context):
    tenant_id = (
        event.get("queryStringParameters") or {}
    ).get("tenant_id")
    streetlight_id = (
        event.get("pathParameters") or {}
    ).get("id")

    if not tenant_id:
        return error(400, "tenant_id is required")
    if not streetlight_id:
        return error(400, "streetlight_id is required")

    try:
        streetlight = _service.execute(tenant_id, streetlight_id)
        if not streetlight:
            return error(404, "Streetlight not found")
        return success(streetlight.to_dict())
    except Exception:
        logger.exception(
            "Failed to get streetlight=%s tenant=%s",
            streetlight_id,
            tenant_id,
        )
        return error(500, "Internal server error")
