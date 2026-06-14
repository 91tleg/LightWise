"""
Lambda authorizer for REST API endpoints.
Reads the access_token HttpOnly cookie, verifies it with Cognito,
and injects claims into requestContext.authorizer.claims.
"""

from __future__ import annotations

from domain.errors import AuthError
from infrastructure.auth.cookie import extract_cookie
from infrastructure.auth.cognito_config import get_cognito_config
from infrastructure.auth.cognito_verifier import CognitoVerifier
from infrastructure.auth.iam import allow_policy


_verifier = CognitoVerifier(get_cognito_config())


def handler(event: dict, context: object) -> dict:
    token = extract_cookie(event, "access_token")
    if not token:
        raise Exception("Unauthorized")

    try:
        claims = _verifier.verify(token)
    except AuthError:
        raise Exception("Unauthorized")

    return allow_policy(
        principal_id=claims.sub,
        method_arn=event["methodArn"],
        context={
            "sub":              claims.sub,
            "custom:tenant_id": claims.tenant_id,
            "email":            claims.email or "",
            "cognito:groups":   ",".join(claims.groups),
            "given_name":       claims.given_name,
            "family_name":      claims.family_name,
            "client_id":        claims.client_id,
        },
    )
