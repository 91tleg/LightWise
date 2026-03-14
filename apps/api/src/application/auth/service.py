from __future__ import annotations

from domain.auth.models import OperatorProfile
from domain.error import AuthError


_ADMIN_GROUP = "admin"
_VALID_ROLES = frozenset({"admin", "operator"})


def profile_from_claims(claims: dict) -> OperatorProfile:
    """
    Build a verified OperatorProfile from Cognito claims.
    Claims are injected by API Gateway Cognito authorizer —
    they are already verified before this function is called.
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
        raise AuthError(
            "Missing given_name and family_name"
        )

    raw_groups = claims.get("cognito:groups", "")
    if isinstance(raw_groups, str):
        groups = frozenset(
            g.strip() for g in raw_groups.split(",") if g.strip()
        )
    elif isinstance(raw_groups, list):
        groups = frozenset(str(g).strip() for g in raw_groups if g)
    else:
        groups = frozenset()

    role = "admin" if _ADMIN_GROUP in groups else "operator"
    if role not in _VALID_ROLES:
        raise AuthError(f"Derived role '{role}' is not a recognised role")

    return OperatorProfile(
        sub=sub,
        tenant_id=tenant_id,
        first_name=first_name,
        last_name=last_name,
        email=email,
        role=role,
    )
