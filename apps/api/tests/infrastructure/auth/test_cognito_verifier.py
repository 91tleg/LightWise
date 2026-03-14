from __future__ import annotations

import json
import time
from unittest.mock import MagicMock, patch

import pytest

from domain.error import AuthError
from infrastructure.auth.cognito_verifier import (
    CognitoConfig, CognitoVerifier
)
from tests.conftest import make_jwks


_URL = "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_ABC123"


def _make_jwks(kid: str = "test-kid") -> dict:
    return make_jwks(kid)


def _make_claims(**overrides) -> dict:
    claims = {
        "sub": "user-123",
        "custom:tenant_id": "tenant-abc",
        "email": "user@example.com",
        "given_name": "Jane",
        "family_name": "Doe",
        "cognito:groups": ["operator"],
        "token_use": "access",
        "client_id": "test-client-id",
        "iss": _URL,
        "exp": int(time.time()) + 3600,
    }
    claims.update(overrides)
    return claims


@pytest.fixture
def config() -> CognitoConfig:
    return CognitoConfig(
        region="us-east-1",
        user_pool_id="us-east-1_ABC123",
        client_id="test-client-id",
    )


@pytest.fixture
def verifier(config: CognitoConfig) -> CognitoVerifier:
    v = CognitoVerifier(config)
    v.__dict__["_jwks"] = _make_jwks()
    return v


def test_config_issuer(config):
    assert config.issuer == _URL


def test_config_jwks_url(config):
    assert config.jwks_url == (
        "https://cognito-idp.us-east-1.amazonaws.com/"
        "us-east-1_ABC123/.well-known/jwks.json"
    )


def test_jwks_fetched_once_across_calls(config):
    fresh_verifier = CognitoVerifier(config)

    with patch("urllib.request.urlopen") as mock_urlopen:
        mock_urlopen.return_value.__enter__.return_value.read.return_value = (
            json.dumps(_make_jwks()).encode()
        )
        _ = fresh_verifier._jwks
        _ = fresh_verifier._jwks
        assert mock_urlopen.call_count == 1


def test_verify_returns_verified_claims(verifier):
    with patch.object(verifier, "_get_public_key", return_value=MagicMock()):
        with patch(
            "jwt.get_unverified_header", return_value={"kid": "test-kid"}
        ):
            with patch("jwt.decode", return_value=_make_claims()):
                result = verifier.verify("some.jwt.token")

    assert result.sub == "user-123"
    assert result.tenant_id == "tenant-abc"
    assert result.email == "user@example.com"
    assert result.given_name == "Jane"
    assert result.family_name == "Doe"
    assert result.groups == ["operator"]
    assert result.client_id == "test-client-id"


def test_verify_admin_group(verifier):
    with patch.object(verifier, "_get_public_key", return_value=MagicMock()):
        with patch(
            "jwt.get_unverified_header", return_value={"kid": "test-kid"}
        ):
            with patch(
                "jwt.decode",
                return_value=_make_claims(**{"cognito:groups": ["admin"]})
            ):
                result = verifier.verify("some.jwt.token")

    assert result.groups == ["admin"]


def test_verify_admin_in_multiple_groups(verifier):
    with patch.object(verifier, "_get_public_key", return_value=MagicMock()):
        with patch(
            "jwt.get_unverified_header", return_value={"kid": "test-kid"}
        ):
            with patch(
                "jwt.decode",
                return_value=_make_claims(
                    **{"cognito:groups": ["operator", "admin"]}
                )
            ):
                result = verifier.verify("some.jwt.token")

    assert "admin" in result.groups


def test_verify_groups_as_string(verifier):
    with patch.object(verifier, "_get_public_key", return_value=MagicMock()):
        with patch(
            "jwt.get_unverified_header", return_value={"kid": "test-kid"}
        ):
            with patch(
                "jwt.decode",
                return_value=_make_claims(**{"cognito:groups": "admin"})
            ):
                result = verifier.verify("some.jwt.token")

    assert result.groups == ["admin"]


def test_verify_no_groups_defaults_to_empty(verifier):
    with patch.object(verifier, "_get_public_key", return_value=MagicMock()):
        with patch(
            "jwt.get_unverified_header", return_value={"kid": "test-kid"}
        ):
            with patch(
                "jwt.decode",
                return_value=_make_claims(**{"cognito:groups": None})
            ):
                result = verifier.verify("some.jwt.token")

    assert result.groups == []


def test_verify_missing_email_is_none(verifier):
    with patch.object(verifier, "_get_public_key", return_value=MagicMock()):
        with patch(
            "jwt.get_unverified_header", return_value={"kid": "test-kid"}
        ):
            with patch(
                "jwt.decode", return_value=_make_claims(email=None)
            ):
                result = verifier.verify("some.jwt.token")

    assert result.email is None


def test_verify_missing_names_default_to_empty_string(verifier):
    with patch.object(verifier, "_get_public_key", return_value=MagicMock()):
        with patch(
            "jwt.get_unverified_header", return_value={"kid": "test-kid"}
        ):
            with patch(
                "jwt.decode",
                return_value=_make_claims(given_name=None, family_name=None)
            ):
                result = verifier.verify("some.jwt.token")

    assert result.given_name == ""
    assert result.family_name == ""


def test_invalid_token_header_raises(verifier):
    import jwt as pyjwt
    with patch(
        "jwt.get_unverified_header", side_effect=pyjwt.DecodeError("bad")
    ):
        with pytest.raises(AuthError, match="Invalid token header"):
            verifier.verify("bad.token")


def test_missing_kid_raises(verifier):
    with patch("jwt.get_unverified_header", return_value={}):
        with pytest.raises(AuthError, match="Token header missing kid"):
            verifier.verify("some.jwt.token")


def test_no_matching_key_raises(verifier):
    verifier.__dict__["_jwks"] = _make_jwks(kid="other-kid")
    with patch(
        "jwt.get_unverified_header", return_value={"kid": "test-kid"}
    ):
        with pytest.raises(AuthError, match="No matching key found for kid"):
            verifier.verify("some.jwt.token")


def test_expired_token_raises(verifier):
    import jwt as pyjwt
    with patch.object(verifier, "_get_public_key", return_value=MagicMock()):
        with patch(
            "jwt.get_unverified_header", return_value={"kid": "test-kid"}
        ):
            with patch("jwt.decode", side_effect=pyjwt.ExpiredSignatureError):
                with pytest.raises(AuthError, match="Token has expired"):
                    verifier.verify("some.jwt.token")


def test_invalid_issuer_raises(verifier):
    import jwt as pyjwt
    with patch.object(verifier, "_get_public_key", return_value=MagicMock()):
        with patch(
            "jwt.get_unverified_header", return_value={"kid": "test-kid"}
        ):
            with patch("jwt.decode", side_effect=pyjwt.InvalidIssuerError):
                with pytest.raises(AuthError, match="Invalid token issuer"):
                    verifier.verify("some.jwt.token")


def test_decode_error_raises(verifier):
    import jwt as pyjwt
    with patch.object(verifier, "_get_public_key", return_value=MagicMock()):
        with patch(
            "jwt.get_unverified_header", return_value={"kid": "test-kid"}
        ):
            with patch("jwt.decode", side_effect=pyjwt.DecodeError("bad")):
                with pytest.raises(AuthError, match="Token decode failed"):
                    verifier.verify("some.jwt.token")


def test_unexpected_token_use_raises(verifier):
    with patch.object(verifier, "_get_public_key", return_value=MagicMock()):
        with patch(
            "jwt.get_unverified_header", return_value={"kid": "test-kid"}
        ):
            with patch(
                "jwt.decode", return_value=_make_claims(token_use="refresh")
            ):
                with pytest.raises(AuthError, match="Unexpected token_use"):
                    verifier.verify("some.jwt.token")


def test_missing_client_id_raises(verifier):
    with patch.object(verifier, "_get_public_key", return_value=MagicMock()):
        with patch(
            "jwt.get_unverified_header", return_value={"kid": "test-kid"}
        ):
            with patch(
                "jwt.decode", return_value=_make_claims(client_id=None)
            ):
                with pytest.raises(
                    AuthError, match="Token missing client_id claim"
                ):
                    verifier.verify("some.jwt.token")


def test_client_id_mismatch_raises(verifier):
    with patch.object(verifier, "_get_public_key", return_value=MagicMock()):
        with patch(
            "jwt.get_unverified_header", return_value={"kid": "test-kid"}
        ):
            with patch(
                "jwt.decode",
                return_value=_make_claims(client_id="wrong-client")
            ):
                with pytest.raises(
                    AuthError, match="Token client_id mismatch"
                ):
                    verifier.verify("some.jwt.token")


def test_missing_tenant_id_raises(verifier):
    with patch.object(verifier, "_get_public_key", return_value=MagicMock()):
        with patch(
            "jwt.get_unverified_header", return_value={"kid": "test-kid"}
        ):
            with patch(
                "jwt.decode",
                return_value=_make_claims(**{"custom:tenant_id": None})
            ):
                with pytest.raises(
                    AuthError, match="Token missing custom:tenant_id claim"
                ):
                    verifier.verify("some.jwt.token")


def test_to_claims_dict_roundtrip(verifier):
    with patch.object(verifier, "_get_public_key", return_value=MagicMock()):
        with patch(
            "jwt.get_unverified_header", return_value={"kid": "test-kid"}
        ):
            with patch("jwt.decode", return_value=_make_claims()):
                result = verifier.verify("some.jwt.token")

    d = result.to_claims_dict()
    assert d["sub"] == "user-123"
    assert d["custom:tenant_id"] == "tenant-abc"
    assert d["email"] == "user@example.com"
    assert d["given_name"] == "Jane"
    assert d["family_name"] == "Doe"
    assert d["cognito:groups"] == ["operator"]
    assert d["client_id"] == "test-client-id"
