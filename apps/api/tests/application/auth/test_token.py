from __future__ import annotations

import pytest

from domain.error import AuthError
from infrastructure.auth.token import extract_bearer_token


def test_valid_bearer_token():
    token = extract_bearer_token("Bearer abc123")
    assert token == "abc123"


def test_valid_bearer_token_case_insensitive():
    token = extract_bearer_token("bearer abc123")
    assert token == "abc123"


def test_missing_header_raises():
    with pytest.raises(AuthError, match="Missing Authorization header"):
        extract_bearer_token(None)


def test_empty_header_raises():
    with pytest.raises(AuthError, match="Missing Authorization header"):
        extract_bearer_token("")


def test_missing_bearer_prefix_raises():
    with pytest.raises(AuthError, match="Authorization header must be"):
        extract_bearer_token("abc123")


def test_wrong_scheme_raises():
    with pytest.raises(AuthError, match="Authorization header must be"):
        extract_bearer_token("Basic abc123")


def test_too_many_parts_raises():
    with pytest.raises(AuthError, match="Authorization header must be"):
        extract_bearer_token("Bearer abc123 extra")


def test_only_bearer_no_token_raises():
    with pytest.raises(AuthError, match="Authorization header must be"):
        extract_bearer_token("Bearer")
