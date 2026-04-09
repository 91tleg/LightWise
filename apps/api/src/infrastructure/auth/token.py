from __future__ import annotations

from domain.errors import AuthError


def extract_bearer_token(authorization_header: str | None) -> str:
    """Pull the raw JWT out of an Authorization: Bearer <token> header."""
    if not authorization_header:
        raise AuthError("Missing Authorization header")

    parts = authorization_header.split()
    if len(parts) != 2 or parts[0].lower() != "bearer":
        raise AuthError("Authorization header must be 'Bearer <token>'")

    return parts[1]
