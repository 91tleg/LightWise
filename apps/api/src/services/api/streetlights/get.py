from application.streetlight.get_streetlight import (
    get_streetlight_service
)
from libs.logging import logger
from libs.response import success, error


_service = get_streetlight_service()


def handler(event, context):
    claims = (
        event
        .get("requestContext", {})
        .get("authorizer", {})
        .get("claims", {})
    )
    tenant_id = claims.get("custom:tenant_id") or claims.get("tenant_id")

    if not tenant_id:
        logger.warning(
            "Missing tenant_id in claims for event=%s",
            event.get("requestContext")
        )
        return error(401, "Unauthorized: missing tenant context")

    streetlight_id = (event.get("pathParameters") or {}).get("id")
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
