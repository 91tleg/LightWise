from domain.errors import AuthError
from domain.auth.models import OperatorProfile
from libs.config import settings


def parse_groups(raw: object) -> frozenset[str]:
    if isinstance(raw, str):
        return frozenset(g.strip() for g in raw.split(",") if g.strip())
    if isinstance(raw, list):
        return frozenset(str(g).strip() for g in raw if g)
    return frozenset()


class IdentityResolver:
    def __call__(self, event: dict) -> tuple[str, str]:
        if not settings.AUTH_ENABLED:
            return "public", "anonymous"

        claims = (
            event
            .get("requestContext", {})
            .get("authorizer", {})
            .get("claims") or {}
        )

        tenant_id = claims.get("custom:tenant_id")
        sub = claims.get("sub")

        if not tenant_id or not sub:
            raise AuthError(
                "Missing tenant_id or sub in authorizer claims"
            )

        return tenant_id, sub


class CognitoClaimsMapper:
    def to_operator_profile(self, claims: dict) -> OperatorProfile:
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
        role = "admin" if "admin" in parse_groups(
            claims.get("cognito:groups", "")
        ) else "operator"
        return OperatorProfile(
            sub=sub,
            tenant_id=tenant_id,
            first_name=first_name,
            last_name=last_name,
            email=email,
            role=role,
        )
