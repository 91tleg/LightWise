"""
Cognito Pre-Token Generation trigger.
Adds custom:tenant_id to the access token claims.
"""

from __future__ import annotations


def handler(event: dict, context: object) -> dict:
    tenant_id = (
        event
        .get("request", {})
        .get("userAttributes", {})
        .get("custom:tenant_id", "")
    )

    event["response"]["claimsAndScopeOverrideDetails"] = {
        "accessTokenGeneration": {
            "claimsToAddOrOverride": {
                "custom:tenant_id": tenant_id,
            }
        }
    }

    return event
