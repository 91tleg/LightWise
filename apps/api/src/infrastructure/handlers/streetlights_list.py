from __future__ import annotations
from functools import lru_cache

from domain.errors import AuthError
from application.streetlight.list_streetlights import ListStreetlights
from application.streetlight.responses import streetlight_to_list_item
from infrastructure.persistence.dynamo.streetlights_repo import (
    get_streetlights_repo
)
from infrastructure.persistence.dynamo.streetlight_metadata_repo import (
    get_streetlight_metadata_repo
)
from infrastructure.auth.identity import resolve_identity
from libs.logging import logger
from libs.response import success, error


@lru_cache(maxsize=1)
def _use_case():
    return ListStreetlights(
        state_repo=get_streetlights_repo(),
        metadata_repo=get_streetlight_metadata_repo()
    )


def handler(event: dict, context: object):
    try:
        tenant_id, _ = resolve_identity(event)
    except AuthError:
        logger.warning("Missing tenant_id or sub in claims")
        return error(401, "Unauthorized")

    try:
        responses = _use_case().execute(tenant_id)
        data = [
            streetlight_to_list_item(r.state, r.metadata)
            for r in responses
        ]
        return success(data)

    except Exception:
        logger.exception(
            "Failed to list streetlights",
            extra={"tenant": tenant_id}
        )
        return error(500, "Internal server error")
