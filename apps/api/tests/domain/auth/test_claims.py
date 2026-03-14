from __future__ import annotations

import pytest

from domain.error import AuthError
from domain.auth.claims import profile_from_claims


def _base_claims(**overrides) -> dict:
    claims = {
        "sub": "user-123",
        "custom:tenant_id": "tenant-abc",
        "email": "user@example.com",
        "given_name": "Jane",
        "family_name": "Doe",
        "cognito:groups": ["operator"],
    }
    claims.update(overrides)
    return claims


def test_valid_claims_returns_profile():
    profile = profile_from_claims(_base_claims())
    assert profile.sub == "user-123"
    assert profile.tenant_id == "tenant-abc"
    assert profile.email == "user@example.com"
    assert profile.first_name == "Jane"
    assert profile.last_name == "Doe"
    assert profile.role == "operator"


def test_admin_group_sets_admin_role():
    profile = profile_from_claims(
        _base_claims(**{"cognito:groups": ["admin"]})
    )
    assert profile.role == "admin"


def test_admin_in_multiple_groups_sets_admin_role():
    profile = profile_from_claims(
        _base_claims(**{"cognito:groups": ["operator", "admin"]})
    )
    assert profile.role == "admin"


def test_no_groups_defaults_to_operator():
    profile = profile_from_claims(
        _base_claims(**{"cognito:groups": []})
    )
    assert profile.role == "operator"


def test_groups_as_comma_separated_string():
    profile = profile_from_claims(
        _base_claims(**{"cognito:groups": "admin,operator"})
    )
    assert profile.role == "admin"


def test_groups_as_string_with_spaces():
    profile = profile_from_claims(
        _base_claims(**{"cognito:groups": " admin , operator "})
    )
    assert profile.role == "admin"


def test_only_first_name_is_valid():
    profile = profile_from_claims(
        _base_claims(given_name="Jane", family_name="")
    )
    assert profile.first_name == "Jane"
    assert profile.last_name == ""


def test_only_last_name_is_valid():
    profile = profile_from_claims(
        _base_claims(given_name="", family_name="Doe")
    )
    assert profile.first_name == ""
    assert profile.last_name == "Doe"


def test_name_whitespace_is_stripped():
    profile = profile_from_claims(
        _base_claims(given_name="  Jane  ", family_name="  Doe  ")
    )
    assert profile.first_name == "Jane"
    assert profile.last_name == "Doe"


def test_missing_sub_raises():
    with pytest.raises(AuthError, match="Missing sub claim"):
        profile_from_claims(_base_claims(sub=None))


def test_empty_sub_raises():
    with pytest.raises(AuthError, match="Missing sub claim"):
        profile_from_claims(_base_claims(sub=""))


def test_missing_tenant_id_raises():
    claims = _base_claims()
    del claims["custom:tenant_id"]
    with pytest.raises(AuthError, match="Missing custom:tenant_id claim"):
        profile_from_claims(claims)


def test_missing_email_raises():
    with pytest.raises(AuthError, match="Missing email claim"):
        profile_from_claims(_base_claims(email=None))


def test_empty_email_raises():
    with pytest.raises(AuthError, match="Missing email claim"):
        profile_from_claims(_base_claims(email=""))


def test_both_names_absent_raises():
    with pytest.raises(AuthError, match="Missing name claims"):
        profile_from_claims(_base_claims(given_name="", family_name=""))


def test_both_names_whitespace_only_raises():
    with pytest.raises(AuthError, match="Missing name claims"):
        profile_from_claims(_base_claims(given_name="  ", family_name="  "))


def test_missing_groups_defaults_to_operator():
    claims = _base_claims()
    del claims["cognito:groups"]
    profile = profile_from_claims(claims)
    assert profile.role == "operator"
