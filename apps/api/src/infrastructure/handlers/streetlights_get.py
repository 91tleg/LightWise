from __future__ import annotations
from functools import lru_cache

from domain.error import AuthError
from application.streetlight.get_streetlight import GetStreetlight
from application.streetlight.responses import streetlight_to_response
from infrastructure.persistence.dynamo.streetlights_repo import (
    get_streetlights_repo
)
from infrastructure.persistence.dynamo.streetlight_metadata_repo import (
    get_streetlight_metadata_repo
)
from infrastructure.auth.identity import IdentityResolver
from libs.logging import logger
from libs.response import success, error


@lru_cache(maxsize=1)
def _use_case():
    return GetStreetlight(
        repo=get_streetlights_repo(),
        metadata_repo=get_streetlight_metadata_repo()
    )


def handler(event: dict, context: object):
    try:
        tenant_id, _ = IdentityResolver()(event)
    except AuthError:
        logger.warning("Missing tenant_id or sub in claims")
        return error(401, "Unauthorized")

    streetlight_id = (event.get("pathParameters") or {}).get("id")
    if not streetlight_id:
        return error(400, "streetlight_id is required")

    try:
        response_dto = _use_case().execute(tenant_id, streetlight_id)
        if not response_dto:
            return error(404, "Streetlight not found")
        return success(streetlight_to_response(response_dto))
    except Exception:
        logger.exception(
            "Failed to get streetlight",
            extra={"streetlight_id": streetlight_id, "tenant_id": tenant_id},
        )
        return error(500, "Internal server error")
