"""
Invite user Lambda handler.

Trigger: API Gateway REST POST /invite-user

Responsibilities:
  - Resolve identity from Cognito claims
  - Parse and validate request body
  - Call InviteUser use case
Only the tenant owner can invite users.
"""

from __future__ import annotations
import json
from functools import lru_cache

from application.tenant.invite_user import InviteUser
from domain.errors import AuthError
from infrastructure.auth.cognito_admin import create_cognito_user
from infrastructure.auth.identity import resolve_identity
from infrastructure.persistence.dynamo.user_tenant_repo import (
    get_user_tenant_repo,
)
from libs.config import settings
from libs.logging import logger
from libs.response import error, success


class _CognitoAdminAdapter:
    def create_cognito_user(
        self,
        user_pool_id: str,
        email: str,
        tenant_id: str,
        role: str,
    ) -> str:
        return create_cognito_user(
            user_pool_id=user_pool_id,
            email=email,
            tenant_id=tenant_id,
            role=role,
        )


@lru_cache(maxsize=1)
def _use_case() -> InviteUser:
    repo = get_user_tenant_repo()
    return InviteUser(
        tenant_repo=repo,
        user_repo=repo,
        cognito=_CognitoAdminAdapter(),
        user_pool_id=settings.COGNITO_USER_POOL_ID,
    )


def handler(event: dict, context: object) -> dict:
    try:
        tenant_id, requesting_user_id = resolve_identity(event)
    except AuthError:
        return error(401, "Unauthorized")

    try:
        body = json.loads(event.get("body") or "{}")
    except json.JSONDecodeError:
        return error(400, "Invalid JSON body")

    email = body.get("email", "").strip()
    role = body.get("role", "").strip()

    if not email:
        return error(400, "email is required")
    if not role:
        return error(400, "role is required")
    if role not in ("admin", "operator"):
        return error(400, "role must be admin or operator")

    try:
        user = _use_case().execute(
            requesting_user_id=requesting_user_id,
            tenant_id=tenant_id,
            email=email,
            role=role,
        )
    except PermissionError as exc:
        logger.warning(
            "Invite user rejected - not owner",
            extra={
                "requesting_user_id": requesting_user_id,
                "tenant_id": tenant_id,
                "email": email,
            },
        )
        return error(403, str(exc))
    except ValueError as exc:
        logger.warning(
            "Invite user rejected - validation failed",
            extra={
                "tenant_id": tenant_id,
                "error": str(exc),
            },
        )
        return error(400, str(exc))
    except AuthError as exc:
        logger.warning(
            "Invite user rejected - Cognito error",
            extra={
                "tenant_id": tenant_id,
                "email": email,
                "error": str(exc),
            },
        )
        return error(409, str(exc))
    except Exception:
        logger.exception(
            "Failed to invite user",
            extra={"tenant_id": tenant_id, "email": email},
        )
        return error(500, "Internal server error")

    logger.info(
        "User invited",
        extra={
            "tenant_id": tenant_id,
            "user_id": user.user_id,
            "email": user.email,
            "role": user.role,
        },
    )
    response = success({
        "user_id": user.user_id,
        "name": user.name,
        "email": user.email,
        "role": user.role,
        "tenant_id": user.tenant_id,
        "created_at": user.created_at,
    })
    response["statusCode"] = 201
    return response
