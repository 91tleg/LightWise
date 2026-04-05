"""
Operator profile API handler.

Trigger: API Gateway REST GET /auth/me

Returns the verified operator profile for the calling user.
The API Gateway Cognito authorizer must be attached - claims are
injected into requestContext.authorizer.claims before this handler runs.

Resolves tenant identity from claims, maps Cognito attributes to an
OperatorProfile
"""

from __future__ import annotations

from domain.error import AuthError
from application.auth.responses import operator_to_response
from infrastructure.auth.identity import CognitoClaimsMapper
from libs.response import error, success


def handler(event: dict, context: object) -> dict:
    claims = (
        event
        .get("requestContext", {})
        .get("authorizer", {})
        .get("claims") or {}
    )

    try:
        profile = CognitoClaimsMapper().to_operator_profile(claims)
    except AuthError:
        return error(401, "Unauthorized")

    return success(operator_to_response(profile))
