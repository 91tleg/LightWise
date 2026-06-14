from __future__ import annotations


def extract_cookie(event: dict, name: str) -> str | None:
    cookies = (event.get("headers") or {}).get("cookie", "")
    for part in cookies.split(";"):
        k, _, v = part.strip().partition("=")
        if k.strip() == name:
            return v.strip()
    return None


def build_auth_cookies(tokens: dict) -> list[str]:
    secure = "HttpOnly; Secure; SameSite=None"

    access_cookie = (
        f"access_token={tokens['access_token']}; "
        f"{secure}; Path=/; Max-Age=3600"
    )

    id_cookie = (
        f"id_token={tokens.get('id_token', '')}; "
        f"{secure}; Path=/; Max-Age=3600"
    )

    cookies = [access_cookie, id_cookie]

    if tokens.get("refresh_token"):
        refresh_cookie = (
            f"refresh_token={tokens['refresh_token']}; "
            f"{secure}; Path=/; Max-Age=2592000"
        )
        cookies.append(refresh_cookie)

    return cookies
