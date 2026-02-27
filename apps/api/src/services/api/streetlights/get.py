import json

from application.streetlight.get_streetlight import (
    get_streetlight_service
)
from libs.logging import logger


_service = get_streetlight_service()


def handler(event, context):
    tenant_id = (
        event.get("queryStringParameters") or {}
    ).get("tenant_id")
    streetlight_id = (
        event.get("pathParameters") or {}
    ).get("id")

    if not tenant_id:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "tenant_id is required"}),
        }

    if not streetlight_id:
        return {
            "statusCode": 400,
            "body": json.dumps({"error": "streetlight_id is required"}),
        }

    try:
        streetlight = _service.execute(tenant_id, streetlight_id)
        if not streetlight:
            return {
                "statusCode": 404,
                "body": json.dumps({"error": "Streetlight not found"}),
            }
        return {
            "statusCode": 200,
            "headers": {"Content-Type": "application/json"},
            "body": json.dumps(streetlight.to_dict()),
        }
    except Exception:
        logger.exception(
            "Failed to get streetlight=%s tenant=%s",
            streetlight_id,
            tenant_id,
        )
        return {
            "statusCode": 500,
            "body": json.dumps({"error": "Internal server error"}),
        }
