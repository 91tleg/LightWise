import pytest
from unittest.mock import patch

from domain.errors import AuthError
from infrastructure.auth.identity import (
    extract_websocket_identity,
    map_cognito_claims,
    parse_groups,
    resolve_identity,
)


def _rest_event(
    tenant_id: str = "tenant-1", sub: str = "user-123"
) -> dict:
    return {
        "requestContext": {
            "authorizer": {
                "claims": {
                    "custom:tenant_id": tenant_id,
                    "sub": sub,
                }
            }
        }
    }


def _ws_event(
    tenant_id: str = "tenant-1", user_id: str = "user-123"
) -> dict:
    return {
        "requestContext": {
            "authorizer": {
                "tenant_id": tenant_id,
                "user_id": user_id,
            }
        }
    }


def _cognito_claims(
    sub: str = "user-123",
    tenant_id: str = "tenant-1",
    email: str = "user@example.com",
    given_name: str = "Jane",
    family_name: str = "Doe",
    groups: str = "",
) -> dict:
    return {
        "sub": sub,
        "custom:tenant_id": tenant_id,
        "email": email,
        "given_name": given_name,
        "family_name": family_name,
        "cognito:groups": groups,
    }


class TestParseGroups:
    def test_comma_separated_string(self):
        assert parse_groups(
            "admin, operators"
        ) == frozenset({"admin", "operators"})

    def test_list_input(self):
        assert parse_groups(
            ["admin", "operators"]
        ) == frozenset({"admin", "operators"})

    def test_empty_string(self):
        assert parse_groups("") == frozenset()

    def test_empty_list(self):
        assert parse_groups([]) == frozenset()

    def test_none_input(self):
        assert parse_groups(None) == frozenset()

    def test_strips_whitespace(self):
        assert parse_groups(
            "  admin  ,  operators  "
        ) == frozenset({"admin", "operators"})

    def test_single_group_string(self):
        assert parse_groups("admin") == frozenset({"admin"})


class TestResolveIdentity:
    def test_returns_tenant_and_sub(self):
        tenant_id, sub = resolve_identity(_rest_event())
        assert tenant_id == "tenant-1"
        assert sub == "user-123"

    def test_missing_tenant_id_raises(self):
        event = _rest_event(tenant_id="")
        with pytest.raises(AuthError, match="tenant_id"):
            resolve_identity(event)

    def test_missing_sub_raises(self):
        event = {
            "requestContext": {
                "authorizer": {"claims": {"custom:tenant_id": "t"}}
            }
        }
        with pytest.raises(AuthError):
            resolve_identity(event)

    def test_missing_claims_raises(self):
        with pytest.raises(AuthError):
            resolve_identity({"requestContext": {"authorizer": {}}})

    def test_missing_request_context_raises(self):
        with pytest.raises(AuthError):
            resolve_identity({})

    def test_auth_disabled_returns_public(self):
        with patch(
            "infrastructure.auth.identity.settings"
        ) as mock_settings:
            mock_settings.AUTH_ENABLED = False
            tenant_id, sub = resolve_identity({})
        assert tenant_id == "public"
        assert sub == "anonymous"


class TestExtractWebsocketIdentity:
    def test_returns_tenant_and_user_id(self):
        tenant_id, user_id = extract_websocket_identity(_ws_event())
        assert tenant_id == "tenant-1"
        assert user_id == "user-123"

    def test_missing_tenant_id_raises(self):
        event = _ws_event(tenant_id="")
        with pytest.raises(AuthError, match="tenant_id"):
            extract_websocket_identity(event)

    def test_missing_user_id_raises(self):
        event = {
            "requestContext": {"authorizer": {"tenant_id": "tenant-1"}}
        }
        with pytest.raises(AuthError):
            extract_websocket_identity(event)

    def test_missing_authorizer_raises(self):
        with pytest.raises(AuthError):
            extract_websocket_identity({"requestContext": {}})

    def test_auth_disabled_returns_public(self):
        with patch(
            "infrastructure.auth.identity.settings"
        ) as mock_settings:
            mock_settings.AUTH_ENABLED = False
            tenant_id, user_id = extract_websocket_identity({})
        assert tenant_id == "public"
        assert user_id == "anonymous"

    def test_does_not_read_claims(self):
        event = {
            "requestContext": {
                "authorizer": {
                    "claims": {
                        "custom:tenant_id": "wrong",
                        "sub": "wrong",
                    }
                }
            }
        }
        with pytest.raises(AuthError):
            extract_websocket_identity(event)


class TestMapCognitoClaims:
    def test_returns_operator_profile(self):
        profile = map_cognito_claims(_cognito_claims())
        assert profile.sub == "user-123"
        assert profile.tenant_id == "tenant-1"
        assert profile.email == "user@example.com"
        assert profile.first_name == "Jane"
        assert profile.last_name == "Doe"

    def test_admin_role_from_group(self):
        profile = map_cognito_claims(_cognito_claims(groups="admin"))
        assert profile.role == "admin"

    def test_operator_role_when_not_admin(self):
        profile = map_cognito_claims(_cognito_claims(groups="operators"))
        assert profile.role == "operator"

    def test_operator_role_when_no_groups(self):
        profile = map_cognito_claims(_cognito_claims(groups=""))
        assert profile.role == "operator"

    def test_missing_sub_raises(self):
        claims = _cognito_claims()
        del claims["sub"]
        with pytest.raises(AuthError, match="sub"):
            map_cognito_claims(claims)

    def test_missing_tenant_id_raises(self):
        claims = _cognito_claims()
        del claims["custom:tenant_id"]
        with pytest.raises(AuthError, match="tenant_id"):
            map_cognito_claims(claims)

    def test_missing_email_raises(self):
        claims = _cognito_claims()
        del claims["email"]
        with pytest.raises(AuthError, match="email"):
            map_cognito_claims(claims)

    def test_missing_both_names_raises(self):
        claims = _cognito_claims(given_name="", family_name="")
        with pytest.raises(AuthError, match="given_name"):
            map_cognito_claims(claims)

    def test_first_name_only_is_valid(self):
        profile = map_cognito_claims(
            _cognito_claims(given_name="Jane", family_name="")
        )
        assert profile.first_name == "Jane"
        assert profile.last_name == ""

    def test_last_name_only_is_valid(self):
        profile = map_cognito_claims(
            _cognito_claims(given_name="", family_name="Doe")
        )
        assert profile.last_name == "Doe"

    def test_whitespace_names_raises(self):
        claims = _cognito_claims(given_name="   ", family_name="   ")
        with pytest.raises(AuthError):
            map_cognito_claims(claims)
