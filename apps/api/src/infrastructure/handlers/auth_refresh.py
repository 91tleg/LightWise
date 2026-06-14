"""
Token refresh handler.
Trigger: API Gateway REST POST /auth/refresh
Reads the refresh_token cookie, exchanges it with Cognito,
and sets new access_token and id_token cookies.
"""
from __future__ import annotations

import json
import urllib.parse
import urllib.request

from infrastructure.auth.cookie import build_auth_cookies, extract_cookie
from infrastructure.auth.cognito_config import get_cognito_config
from libs.response import CORS_HEADERS, error

_config = get_cognito_config()


def handler(event: dict, context: object) -> dict:
    refresh_token = extract_cookie(event, "refresh_token")
    if not refresh_token:
        return error(401, "No refresh token")

    tokens = _refresh(refresh_token)
    if tokens is None:
        return error(401, "Token refresh failed")

    return {
        "statusCode": 200,
        "headers": CORS_HEADERS,
        "multiValueHeaders": {
            "Set-Cookie": build_auth_cookies(tokens),
        },
        "body": json.dumps({"ok": True}),
    }


def _refresh(refresh_token: str) -> dict | None:
    payload = urllib.parse.urlencode({
        "grant_type":    "refresh_token",
        "client_id":     _config.client_id,
        "refresh_token": refresh_token,
    }).encode()

    req = urllib.request.Request(
        f"https://{_config.token_url}",
        data=payload,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            return json.loads(r.read())
    except Exception:
        return None
