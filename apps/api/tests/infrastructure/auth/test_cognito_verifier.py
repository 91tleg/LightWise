from __future__ import annotations
import json
import time
from unittest.mock import MagicMock, patch
import pytest

from domain.errors import AuthError
from infrastructure.auth.cognito_verifier import CognitoVerifier


_URL = "https://cognito-idp.us-east-1.amazonaws.com/us-east-1_ABC123"


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


def test_config_issuer(cognito_config):
    assert cognito_config.issuer == _URL


def test_config_jwks_url(cognito_config):
    assert cognito_config.jwks_url == (
        f"{_URL}/.well-known/jwks.json"
    )


def test_jwks_fetched_once_across_calls(cognito_config):
    fresh_verifier = CognitoVerifier(cognito_config)

    with patch("urllib.request.urlopen") as mock_urlopen:
        from tests.conftest import make_jwks
        mock_urlopen.return_value.__enter__.return_value.read.return_value = (
            json.dumps(make_jwks()).encode()
        )

        _ = fresh_verifier._jwks
        _ = fresh_verifier._jwks

        assert mock_urlopen.call_count == 1


def test_verify_returns_verified_claims(cognito_verifier):
    with patch.object(
        cognito_verifier, "_get_public_key", return_value=MagicMock()
    ):
        with patch(
            "jwt.get_unverified_header", return_value={"kid": "test-kid"}
        ):
            with patch("jwt.decode", return_value=_make_claims()):
                result = cognito_verifier.verify("some.jwt.token")

    assert result.sub == "user-123"
    assert result.tenant_id == "tenant-abc"
    assert result.email == "user@example.com"
    assert result.groups == frozenset(["operator"])
    assert result.client_id == "test-client-id"


def test_verify_accepts_id_token_audience(cognito_verifier):
    claims = _make_claims(
        token_use="id",
        aud="test-client-id",
        client_id=None,
    )
    with patch.object(
        cognito_verifier, "_get_public_key", return_value=MagicMock()
    ):
        with patch(
            "jwt.get_unverified_header", return_value={"kid": "test-kid"}
        ):
            with patch("jwt.decode", return_value=claims):
                result = cognito_verifier.verify("some.jwt.token")

    assert result.client_id == "test-client-id"


def test_verify_accepts_id_token_audience_list(cognito_verifier):
    claims = _make_claims(
        token_use="id",
        aud=["other-client", "test-client-id"],
        client_id=None,
    )
    with patch.object(
        cognito_verifier, "_get_public_key", return_value=MagicMock()
    ):
        with patch(
            "jwt.get_unverified_header", return_value={"kid": "test-kid"}
        ):
            with patch("jwt.decode", return_value=claims):
                result = cognito_verifier.verify("some.jwt.token")

    assert result.client_id == "test-client-id"


def test_verify_admin_in_multiple_groups(cognito_verifier):
    with patch.object(
        cognito_verifier, "_get_public_key", return_value=MagicMock()
    ):
        with patch(
            "jwt.get_unverified_header", return_value={"kid": "test-kid"}
        ):
            claims = _make_claims(**{"cognito:groups": ["operator", "admin"]})
            with patch("jwt.decode", return_value=claims):
                result = cognito_verifier.verify("some.jwt.token")

    assert result.groups == frozenset(["operator", "admin"])
    assert "admin" in result.groups


def test_verify_no_groups_defaults_to_empty_frozenset(cognito_verifier):
    with patch.object(
        cognito_verifier, "_get_public_key", return_value=MagicMock()
    ):
        with patch(
            "jwt.get_unverified_header", return_value={"kid": "test-kid"}
        ):
            with patch(
                "jwt.decode",
                return_value=_make_claims(**{"cognito:groups": None})
            ):
                result = cognito_verifier.verify("some.jwt.token")

    assert result.groups == frozenset()


def test_verify_missing_email_is_none(cognito_verifier):
    with patch.object(
        cognito_verifier, "_get_public_key", return_value=MagicMock()
    ):
        with patch(
            "jwt.get_unverified_header", return_value={"kid": "test-kid"}
        ):
            with patch("jwt.decode", return_value=_make_claims(email=None)):
                result = cognito_verifier.verify("some.jwt.token")

    assert result.email is None


def test_invalid_token_header_raises(cognito_verifier):
    import jwt as pyjwt
    with patch(
        "jwt.get_unverified_header", side_effect=pyjwt.DecodeError("bad")
    ):
        with pytest.raises(AuthError, match="Invalid token header"):
            cognito_verifier.verify("bad.token")


def test_no_matching_key_raises(cognito_verifier):
    from tests.conftest import make_jwks
    cognito_verifier.__dict__["_jwks"] = make_jwks(kid="different-kid")

    with patch(
        "jwt.get_unverified_header", return_value={"kid": "test-kid"}
    ):
        with pytest.raises(AuthError, match="No matching key found for kid"):
            cognito_verifier.verify("some.jwt.token")


def test_expired_token_raises(cognito_verifier):
    import jwt as pyjwt
    with patch.object(
        cognito_verifier, "_get_public_key", return_value=MagicMock()
    ):
        with patch(
            "jwt.get_unverified_header", return_value={"kid": "test-kid"}
        ):
            with patch("jwt.decode", side_effect=pyjwt.ExpiredSignatureError):
                with pytest.raises(AuthError, match="Token has expired"):
                    cognito_verifier.verify("some.jwt.token")


def test_client_id_mismatch_raises(cognito_verifier):
    with patch.object(
        cognito_verifier, "_get_public_key", return_value=MagicMock()
    ):
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
                    cognito_verifier.verify("some.jwt.token")


def test_id_token_audience_mismatch_raises(cognito_verifier):
    claims = _make_claims(
        token_use="id",
        aud="wrong-client",
        client_id=None,
    )
    with patch.object(
        cognito_verifier, "_get_public_key", return_value=MagicMock()
    ):
        with patch(
            "jwt.get_unverified_header", return_value={"kid": "test-kid"}
        ):
            with patch("jwt.decode", return_value=claims):
                with pytest.raises(
                    AuthError, match="Token client_id mismatch"
                ):
                    cognito_verifier.verify("some.jwt.token")


def test_missing_tenant_id_raises(cognito_verifier):
    with patch.object(
        cognito_verifier, "_get_public_key", return_value=MagicMock()
    ):
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
                    cognito_verifier.verify("some.jwt.token")
