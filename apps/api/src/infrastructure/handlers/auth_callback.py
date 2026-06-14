"""
Auth callback handler.
Trigger: API Gateway REST GET /auth/callback
Exchanges a Cognito authorization code for tokens and sets HttpOnly cookies.
Cognito redirects here after successful login with ?code=xxx.
"""
from __future__ import annotations

import urllib.parse
import urllib.request

from infrastructure.auth.cookie import build_auth_cookies
from infrastructure.auth.cognito_config import get_cognito_config
from libs.config import settings
from libs.response import error


_config = get_cognito_config()


def handler(event: dict, context: object) -> dict:
    code = (event.get("queryStringParameters") or {}).get("code")
    if not code:
        return error(400, "Missing code")

    tokens = _exchange_code(code)
    if tokens is None:
        return error(401, "Token exchange failed")

    return {
        "statusCode": 200,
        "multiValueHeaders": {
            "Location": [settings.FRONTEND_URL],
            "Set-Cookie": build_auth_cookies(tokens),
        },
        "body": "",
    }


def _exchange_code(code: str) -> dict | None:
    payload = urllib.parse.urlencode({
        "grant_type":   "authorization_code",
        "client_id":    _config.client_id,
        "code":         code,
        "redirect_uri": settings.COGNITO_REDIRECT_URI,
    }).encode()

    req = urllib.request.Request(
        f"https://{settings.COGNITO_DOMAIN}/oauth2/token",
        data=payload,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=10) as r:
            import json
            return json.loads(r.read())
    except Exception:
        return None
