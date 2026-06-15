"""
Operator profile API handler.

Trigger: API Gateway REST GET /auth/me

Returns the verified operator profile for the calling user.
The Lambda cookie authorizer must be attached - claims are
injected into requestContext.authorizer.claims before this handler runs.
Resolves tenant identity from claims, maps Cognito attributes to an
OperatorProfile
"""

from __future__ import annotations

from domain.errors import AuthError
from application.auth.responses import operator_to_response
from infrastructure.auth.identity import map_cognito_claims
from libs.response import error, success
from libs.logging import logger


def handler(event: dict, context: object) -> dict:
    claims = (
        event
        .get("requestContext", {})
        .get("authorizer", {})
        .get("claims") or {}
    )
    logger.info("Claims received: %s", claims)

    try:
        profile = map_cognito_claims(claims)
    except AuthError as e:
        logger.error("AuthError: %s", str(e))
        return error(401, "Unauthorized")

    return success(operator_to_response(profile))
