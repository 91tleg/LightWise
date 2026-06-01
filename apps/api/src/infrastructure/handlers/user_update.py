"""
Update user Lambda handler.

Trigger: API Gateway REST PATCH /users/{id}

Updates a user's name inside the tenant.
Only the tenant owner can update users.
"""

from __future__ import annotations
import json
from functools import lru_cache

from application.tenant.update_user import UpdateUser
from domain.errors import AuthError
from infrastructure.auth.identity import resolve_identity
from infrastructure.persistence.dynamo.user_tenant_repo import (
    get_user_tenant_repo,
)
from libs.logging import logger
from libs.response import error, success


@lru_cache(maxsize=1)
def _use_case() -> UpdateUser:
    repo = get_user_tenant_repo()
    return UpdateUser(
        tenant_repo=repo,
        user_repo=repo,
    )


def handler(event: dict, context: object) -> dict:
    try:
        tenant_id, requesting_user_id = resolve_identity(event)
    except AuthError:
        return error(401, "Unauthorized")

    user_id = (event.get("pathParameters") or {}).get("id")
    if not user_id:
        return error(400, "user_id is required")

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return error(400, "Invalid JSON body")

    name = body.get("name", "").strip()

    if not name:
        return error(400, "name is required")

    try:
        user = _use_case().execute(
            requesting_user_id=requesting_user_id,
            tenant_id=tenant_id,
            user_id=user_id,
            name=name,
        )
    except PermissionError as exc:
        return error(403, str(exc))
    except ValueError as exc:
        logger.warning(
            "Update user rejected",
            extra={
                "tenant_id": tenant_id,
                "user_id": user_id,
                "error": str(exc),
            },
        )
        return error(400, str(exc))
    except Exception:
        logger.exception(
            "Failed to update user",
            extra={"tenant_id": tenant_id, "user_id": user_id},
        )
        return error(500, "Internal server error")

    return success({
        "user_id": user.user_id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "tenant_id": user.tenant_id,
        "created_at": user.created_at,
    })
