from application.streetlight.list_streetlights import get_list_streetlights
from libs.logging import logger
from libs.response import success, error


_service = get_list_streetlights()


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

    try:
        streetlights = _service.execute(tenant_id)
        return success([s.to_dict() for s in streetlights])
    except Exception:
        logger.exception(
            "Failed to list streetlights for tenant=%s", tenant_id
        )
        return error(500, "Internal server error")
