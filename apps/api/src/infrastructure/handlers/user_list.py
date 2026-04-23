"""
List users Lambda handler.

Trigger: API Gateway REST GET /users

Returns all users belonging to the requesting user's tenant.
Any authenticated user in the tenant can list users.
"""

from __future__ import annotations
from functools import lru_cache

from apps.api.src.application.tenant.list_users import ListUsers
from domain.errors import AuthError
from infrastructure.auth.identity import resolve_identity
from infrastructure.persistence.dynamo.user_tenant_repo import (
    get_user_tenant_repo,
)
from libs.logging import logger
from libs.response import error, success


@lru_cache(maxsize=1)
def _use_case() -> ListUsers:
    return ListUsers(user_repo=get_user_tenant_repo())


def handler(event: dict, context: object) -> dict:
    try:
        tenant_id, _ = resolve_identity(event)
    except AuthError:
        return error(401, "Unauthorized")

    try:
        users = _use_case().execute(tenant_id)
    except Exception:
        logger.exception(
            "Failed to list users",
            extra={"tenant_id": tenant_id},
        )
        return error(500, "Internal server error")

    return success([
        {
            "user_id": u.user_id,
            "email": u.email,
            "role": u.role,
            "tenant_id": u.tenant_id,
            "created_at": u.created_at,
        }
        for u in users
    ])
    