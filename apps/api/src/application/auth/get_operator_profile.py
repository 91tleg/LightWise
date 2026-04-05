"""
GetOperatorProfile application use case.

Extracts and validates the operator profile from the API Gateway
authorizer claims injected into the request context.

No token verification is performed here - the API Gateway Cognito
authorizer has already verified the token before this handler runs.
"""

from __future__ import annotations

from domain.auth.claims import profile_from_claims
from domain.auth.models import OperatorProfile


class GetOperatorProfile:
    def execute(self, event: dict) -> OperatorProfile:
        """
        Build an OperatorProfile from the request context claims.
        """
        claims = (
            event
            .get("requestContext", {})
            .get("authorizer", {})
            .get("claims")
        )

        if not claims or not isinstance(claims, dict):
            raise ValueError(
                "Missing authentication context in requestContext"
            )

        return profile_from_claims(claims)
