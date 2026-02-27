import json

from application.streetlight.list_streetlights import get_list_streetlights
from libs.logging import logger


_service = get_list_streetlights()


def handler(event, context):
    tenant_id = (
        event.get("queryStringParameters") or {}
    ).get("tenant_id")

    if not tenant_id:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "tenant_id is required"}),
        }

    try:
        streetlights = _service.execute(tenant_id)
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps([s.to_dict() for s in streetlights]),
        }
    except Exception:
        logger.exception(
            "Failed to list streetlights for tenant=%s", tenant_id
        )
        return {
            "statusCode": 500,
            "body": json.dumps({"error": "Internal server error"}),
        }
