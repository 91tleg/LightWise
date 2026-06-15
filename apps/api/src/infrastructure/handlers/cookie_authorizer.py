"""
Lambda authorizer for REST API endpoints.
Reads the access_token HttpOnly cookie, verifies it with Cognito,
and injects claims into requestContext.authorizer.claims.
"""

from __future__ import annotations
import base64
import json

from domain.errors import AuthError
from infrastructure.auth.cookie import extract_cookie
from infrastructure.auth.cognito_config import get_cognito_config
from infrastructure.auth.cognito_verifier import CognitoVerifier
from infrastructure.auth.iam import allow_policy
from libs.logging import logger


_verifier = CognitoVerifier(get_cognito_config())


def handler(event: dict, context: object) -> dict:
    token = extract_cookie(event, "access_token")
    if not token:
        logger.error(
            "No access_token cookie found. Headers: %s", event.get("headers")
        )
        raise Exception("Unauthorized")

    try:
        claims = _verifier.verify(token)
    except AuthError as e:
        logger.error("Token verification failed: %s", str(e))
        raise Exception("Unauthorized")

    id_token = extract_cookie(event, "id_token")
    id_claims = _get_id_claims(id_token) if id_token else {}

    logger.info(
        "Authorized sub=%s tenant_id=%s", claims.sub, claims.tenant_id
    )

    return allow_policy(
        principal_id=claims.sub,
        method_arn=event["methodArn"],
        context={
            "sub":              claims.sub,
            "custom:tenant_id": claims.tenant_id,
            "email":            id_claims.get("email") or "",
            "cognito:groups":   ",".join(claims.groups),
            "given_name":       id_claims.get("given_name") or "",
            "family_name":      id_claims.get("family_name") or "",
            "client_id":        claims.client_id,
        },
    )


def _get_id_claims(id_token: str) -> dict:
    """
    Extract claims from ID token without verification.
    The access token is already verified — ID token is only used
    for profile attributes, not for authorization decisions.
    """
    try:
        payload = id_token.split(".")[1]
        # add padding
        payload += "=" * (4 - len(payload) % 4)
        return json.loads(base64.b64decode(payload))
    except Exception:
        return {}
