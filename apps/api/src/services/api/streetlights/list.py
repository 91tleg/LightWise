from application.streetlight.list_streetlights import get_list_streetlights
from libs.logging import logger
from libs.response import success, error


_service = get_list_streetlights()


def handler(event, context):
    tenant_id = (
        event.get("queryStringParameters") or {}
    ).get("tenant_id")

    if not tenant_id:
        return error(400, "tenant_id is required")

    try:
        streetlights = _service.execute(tenant_id)
        return success([s.to_dict() for s in streetlights])
    except Exception:
        logger.exception(
            "Failed to list streetlights for tenant=%s", tenant_id
        )
        return error(500, "Internal server error")
