from domain.errors import AuthError
from domain.auth.models import OperatorProfile
from libs.config import settings


def parse_groups(raw: object) -> frozenset[str]:
    if isinstance(raw, str):
        return frozenset(g.strip() for g in raw.split(",") if g.strip())
    if isinstance(raw, list):
        return frozenset(str(g).strip() for g in raw if g)
    return frozenset()


def resolve_identity(event: dict) -> tuple[str, str]:
    """
    Extract tenant_id and sub from REST API Gateway authorizer claims.
    Cognito authorizer injects claims into requestContext.authorizer.claims
    before the handler runs.
    """
    if not settings.AUTH_ENABLED:
        return "public", "anonymous"

    authorizer = (
        event
        .get("requestContext", {})
        .get("authorizer", {})
    )

    claims = authorizer.get("claims") or authorizer

    tenant_id = claims.get("custom:tenant_id")
    sub = claims.get("sub")

    if not tenant_id or not sub:
        raise AuthError("Missing tenant_id or sub in authorizer claims")

    return tenant_id, sub


def extract_websocket_identity(event: dict) -> tuple[str, str]:
    """
    Extract tenant_id and user_id from the WebSocket authorizer context.
    Lambda authorizer injects these directly into requestContext.authorizer
    , not nested under 'claims' like REST Cognito claims.
    """
    if not settings.AUTH_ENABLED:
        return "public", "anonymous"

    authorizer = (
        event
        .get("requestContext", {})
        .get("authorizer", {})
    )
    tenant_id = authorizer.get("tenant_id")
    user_id = authorizer.get("user_id")

    if not tenant_id or not user_id:
        raise AuthError(
            "Missing tenant_id or user_id in WebSocket authorizer context"
        )

    return tenant_id, user_id


def map_cognito_claims(claims: dict) -> OperatorProfile:
    """
    Map Cognito JWT claims to an OperatorProfile.
    Used only by GET /auth/me — all other handlers use resolve_identity.
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


def resolve_email(event: dict) -> str:
    """
    Extract email from REST API Gateway authorizer claims.
    Falls back to sub if email is not present.
    """
    if not settings.AUTH_ENABLED:
        return "anonymous"

    authorizer = (
        event
        .get("requestContext", {})
        .get("authorizer", {})
    )

    claims = authorizer.get("claims") or authorizer

    return claims.get("email") or claims.get("sub") or "unknown"
