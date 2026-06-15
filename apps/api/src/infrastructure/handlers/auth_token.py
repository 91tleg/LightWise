"""
Returns access token for WebSocket authentication.

Trigger: API Gateway REST GET /auth/token

Protected by cookie authorizer - only reachable with valid session.
"""

from __future__ import annotations
from infrastructure.auth.cookie import extract_cookie
from libs.response import error, success


def handler(event: dict, context: object) -> dict:
    token = extract_cookie(event, "access_token")
    if not token:
        return error(401, "No token")
    return success({"token": token})
