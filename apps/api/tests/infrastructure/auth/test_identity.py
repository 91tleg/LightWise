import pytest
from unittest.mock import patch

from domain.errors import AuthError
from domain.auth.models import OperatorProfile
from infrastructure.auth.identity import (
    parse_groups, IdentityResolver, CognitoClaimsMapper
)


@pytest.mark.parametrize("input_val, expected", [
    ("admin, operator", frozenset(["admin", "operator"])),
    ("  admin  ", frozenset(["admin"])),
    (["admin", "viewer"], frozenset(["admin", "viewer"])),
    ([1, 2], frozenset(["1", "2"])),
    (None, frozenset()),
    ("", frozenset()),
    ([], frozenset()),
])
def test_parse_groups(input_val, expected):
    assert parse_groups(input_val) == expected


class TestIdentityResolver:
    def test_returns_anonymous_when_auth_disabled(self):
        with patch("infrastructure.auth.identity.settings") as mock_settings:
            mock_settings.AUTH_ENABLED = False
            resolver = IdentityResolver()
            tenant_id, sub = resolver({})
            assert tenant_id == "public"
            assert sub == "anonymous"

    def test_resolves_valid_claims(self):
        with patch("infrastructure.auth.identity.settings") as mock_settings:
            mock_settings.AUTH_ENABLED = True
            event = {
                "requestContext": {
                    "authorizer": {
                        "claims": {
                            "custom:tenant_id": "tenant-123",
                            "sub": "user-456"
                        }
                    }
                }
            }
            resolver = IdentityResolver()
            tenant, sub = resolver(event)
            assert tenant == "tenant-123"
            assert sub == "user-456"

    def test_raises_on_missing_claims(self):
        with patch("infrastructure.auth.identity.settings") as mock_settings:
            mock_settings.AUTH_ENABLED = True
            resolver = IdentityResolver()
            with pytest.raises(AuthError, match="Missing tenant_id or sub"):
                resolver({"requestContext": {"authorizer": {"claims": {}}}})


class TestCognitoClaimsMapper:
    @pytest.fixture
    def mapper(self):
        return CognitoClaimsMapper()

    @pytest.fixture
    def valid_claims(self):
        return {
            "sub": "sub-1",
            "custom:tenant_id": "t-1",
            "email": "test@example.com",
            "given_name": "John",
            "family_name": "Doe",
            "cognito:groups": "operator, admin"
        }

    def test_maps_valid_admin_profile(self, mapper, valid_claims):
        profile = mapper.to_operator_profile(valid_claims)

        assert isinstance(profile, OperatorProfile)
        assert profile.sub == "sub-1"
        assert profile.role == "admin"
        assert profile.first_name == "John"

    def test_maps_operator_role_if_not_in_admin_group(
        self, mapper, valid_claims
    ):
        valid_claims["cognito:groups"] = ["operator"]
        profile = mapper.to_operator_profile(valid_claims)
        assert profile.role == "operator"

    @pytest.mark.parametrize("missing_field", [
        "sub", "custom:tenant_id", "email"
    ])
    def test_raises_on_missing_required_fields(
        self, mapper, valid_claims, missing_field
    ):
        del valid_claims[missing_field]
        with pytest.raises(AuthError, match=f"Missing {missing_field}"):
            mapper.to_operator_profile(valid_claims)

    def test_raises_if_both_names_missing(self, mapper, valid_claims):
        valid_claims["given_name"] = " "
        valid_claims["family_name"] = ""
        with pytest.raises(
            AuthError, match="Missing given_name and family_name"
        ):
            mapper.to_operator_profile(valid_claims)

    def test_handles_missing_optional_name_parts(self, mapper, valid_claims):
        valid_claims["family_name"] = ""
        profile = mapper.to_operator_profile(valid_claims)
        assert profile.first_name == "John"
        assert profile.last_name == ""
