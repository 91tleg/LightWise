from infrastructure.auth.cookie import build_auth_cookies


def test_auth_cookies_are_cross_site_partitioned():
    cookies = build_auth_cookies(
        {
            "access_token": "access",
            "id_token": "id",
            "refresh_token": "refresh",
        }
    )

    assert len(cookies) == 3
    for cookie in cookies:
        assert "HttpOnly" in cookie
        assert "Secure" in cookie
        assert "SameSite=None" in cookie
        assert "Partitioned" in cookie
