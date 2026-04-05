"""
Operator profile construction from Cognito claims.

Claims are injected by the API Gateway Cognito authorizer and are
already cryptographically verified before this function is called.
"""

from __future__ import annotations

from domain.auth.models import OperatorProfile
from domain.error import AuthError


_ADMIN_GROUP = "admin"
_VALID_ROLES = frozenset({"admin", "operator"})


def profile_from_claims(claims: dict) -> OperatorProfile:
    """
    Build a verified OperatorProfile from Cognito JWT claims.
    """
    sub = claims.get("sub")
    if not sub:
        raise AuthError("Missing sub claim")

    tenant_id = claims.get("custom:tenant_id")
    if not tenant_id:
        raise AuthError("Missing custom:tenant_id claim")

    email = claims.get("email")
    if not email:
        raise AuthError("Missing email claim")

    first_name = claims.get("given_name", "").strip()
    last_name = claims.get("family_name", "").strip()
    if not first_name and not last_name:
        raise AuthError("Missing given_name and family_name claims")

    groups = _parse_groups(claims.get("cognito:groups", ""))
    role = "admin" if _ADMIN_GROUP in groups else "operator"

    if role not in _VALID_ROLES:
        raise AuthError(f"Derived role '{role}' is not a recognized role")

    return OperatorProfile(
        sub=sub,
        tenant_id=tenant_id,
        first_name=first_name,
        last_name=last_name,
        email=email,
        role=role,
    )


def _parse_groups(raw: object) -> frozenset[str]:
    """
    Parse cognito:groups claim into a frozenset.

    API Gateway may inject groups as a comma-separated string or a list
    depending on the authorizer configuration.
    """
    if isinstance(raw, str):
        return frozenset(g.strip() for g in raw.split(",") if g.strip())
    if isinstance(raw, list):
        return frozenset(str(g).strip() for g in raw if g)
    return frozenset()
