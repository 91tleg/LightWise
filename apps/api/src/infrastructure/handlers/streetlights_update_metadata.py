from __future__ import annotations
import json
from functools import lru_cache

from domain.errors import AuthError
from application.streetlight.update_metadata import (
    UpdateStreetlightMetadata
)
from infrastructure.persistence.dynamo.streetlight_metadata_repo import (
    get_streetlight_metadata_repo,
)
from infrastructure.auth.identity import IdentityResolver
from libs.logging import logger
from libs.response import success, error


@lru_cache(maxsize=1)
def _use_case() -> UpdateStreetlightMetadata:
    return UpdateStreetlightMetadata(
        repo=get_streetlight_metadata_repo()
    )


def handler(event: dict, context: object) -> dict:
    try:
        tenant_id, _ = IdentityResolver()(event)
    except AuthError:
        logger.warning("Missing tenant_id or sub in claims")

        return error(401, "Unauthorized")
    streetlight_id = (event.get("pathParameters") or {}).get("id")
    if not streetlight_id:
        return error(400, "streetlight_id is required")

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return error(400, "Invalid JSON body")

    try:
        _use_case().execute(
            tenant_id=tenant_id,
            streetlight_id=streetlight_id,
            name=body.get("name"),
            lat=body.get("lat"),
            lng=body.get("lng"),
        )
        return success({"message": "updated"})
    except ValueError as exc:
        logger.warning(
            "Validation error updating streetlight metadata",
            extra={
                "streetlight_id": streetlight_id,
                "error": str(exc),
            },
        )
        return error(400, str(exc))
    except Exception:
        logger.exception(
            "Failed to update metadata",
            extra={"streetlight_id": streetlight_id},
        )
        return error(500, "Internal server error")
