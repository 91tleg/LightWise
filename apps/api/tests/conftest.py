import pytest
from infrastructure.auth.cognito_verifier import CognitoConfig, CognitoVerifier


def make_jwks(kid: str = "test-kid") -> dict:
    return {
        "keys": [
            {
                "kid": kid,
                "kty": "RSA",
                "alg": "RS256",
                "use": "sig",
                "n": "sampleN",
                "e": "AQAB",
            }
        ]
    }


@pytest.fixture(scope="session")
def cognito_config() -> CognitoConfig:
    return CognitoConfig(
        region="us-east-1",
        user_pool_id="us-east-1_ABC123",
        client_id="test-client-id",
    )


@pytest.fixture
def cognito_verifier(cognito_config: CognitoConfig) -> CognitoVerifier:
    v = CognitoVerifier(cognito_config)
    v.__dict__["_jwks"] = make_jwks()
    return v
