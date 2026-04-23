"""
Remove user Lambda handler.

Trigger: API Gateway REST DELETE /users/{id}

Responsibilities:
  - Resolve identity from Cognito claims
  - Call RemoveUser use case
Only the tenant owner can remove users.
"""

from __future__ import annotations
from functools import lru_cache

from application.tenant.remove_user import RemoveUser
from domain.errors import AuthError
from infrastructure.auth.cognito_admin import delete_cognito_user
from infrastructure.auth.identity import resolve_identity
from infrastructure.persistence.dynamo.user_tenant_repo import (
    get_user_tenant_repo,
)
from libs.config import settings
from libs.logging import logger
from libs.response import error, success


class _CognitoAdminAdapter:
    def delete_cognito_user(self, user_pool_id: str, email: str) -> None:
        delete_cognito_user(user_pool_id=user_pool_id, email=email)


@lru_cache(maxsize=1)
def _use_case() -> RemoveUser:
    repo = get_user_tenant_repo()
    return RemoveUser(
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

    user_id = (event.get("pathParameters") or {}).get("id")
    if not user_id:
        return error(400, "user_id is required")

    try:
        _use_case().execute(
            requesting_user_id=requesting_user_id,
            tenant_id=tenant_id,
            user_id=user_id,
        )
    except PermissionError as exc:
        logger.warning(
            "Remove user rejected - not owner",
            extra={
                "requesting_user_id": requesting_user_id,
                "tenant_id": tenant_id,
                "user_id": user_id,
            },
        )
        return error(403, str(exc))
    except ValueError as exc:
        logger.warning(
            "Remove user rejected - validation failed",
            extra={
                "tenant_id": tenant_id,
                "user_id": user_id,
                "error": str(exc),
            },
        )
        return error(400, str(exc))
    except AuthError as exc:
        logger.warning(
            "Remove user rejected - Cognito error",
            extra={
                "tenant_id": tenant_id,
                "user_id": user_id,
                "error": str(exc),
            },
        )
        return error(409, str(exc))
    except Exception:
        logger.exception(
            "Failed to remove user",
            extra={"tenant_id": tenant_id, "user_id": user_id},
        )
        return error(500, "Internal server error")

    logger.info(
        "User removed",
        extra={
            "tenant_id": tenant_id,
            "user_id": user_id,
            "requesting_user_id": requesting_user_id,
        },
    )
    return success({"message": "User removed"})

