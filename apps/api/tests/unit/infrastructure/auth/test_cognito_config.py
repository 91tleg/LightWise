import pytest
from dataclasses import FrozenInstanceError

from infrastructure.auth.cognito_config import CognitoConfig


class TestCognitoConfig:
    def test_issuer_url_generation(self, cognito_config):
        expected = (
            "https://cognito-idp.us-east-1.amazonaws.com/"
            "us-east-1_ABC123"
        )
        assert cognito_config.issuer == expected

    def test_jwks_url_generation(self, cognito_config):
        expected = (
            "https://cognito-idp.us-east-1.amazonaws.com/"
            "us-east-1_ABC123/.well-known/jwks.json"
        )
        assert cognito_config.jwks_url == expected

    def test_immutability(self, cognito_config):
        with pytest.raises(FrozenInstanceError):
            cognito_config.region = "us-west-2"

    def test_equality(self):
        c1 = CognitoConfig("us-east-1", "pool-1", "client-1")
        c2 = CognitoConfig("us-east-1", "pool-1", "client-1")
        assert c1 == c2

    def test_inequality(self):
        c1 = CognitoConfig("us-east-1", "pool-1", "client-1")
        c2 = CognitoConfig("us-west-2", "pool-1", "client-1")
        assert c1 != c2
