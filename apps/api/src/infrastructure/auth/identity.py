from domain.error import AuthError
from libs.config import settings


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
