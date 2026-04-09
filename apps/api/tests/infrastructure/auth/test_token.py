import pytest

from domain.errors import AuthError
from infrastructure.auth.token import extract_bearer_token


class TestExtractBearerToken:
    def test_extract_valid_token(self):
        header = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"
        token = extract_bearer_token(header)
        assert token == "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9"

    def test_extract_is_case_insensitive(self):
        header = "bearer some-token-123"
        assert extract_bearer_token(header) == "some-token-123"

    def test_raises_on_none_header(self):
        with pytest.raises(AuthError, match="Missing Authorization header"):
            extract_bearer_token(None)

    def test_raises_on_empty_string(self):
        with pytest.raises(AuthError, match="Missing Authorization header"):
            extract_bearer_token("")

    @pytest.mark.parametrize("malformed_header", [
        "Basic dXNlcjpwYXNz",          # Wrong scheme
        "Bearer",                      # Missing token part
        "Bearer token extra-stuff",    # Too many parts
        "NotBearer token",             # Invalid prefix
        "token-without-prefix"         # Missing prefix
    ])
    def test_raises_on_malformed_header(self, malformed_header):
        with pytest.raises(
            AuthError, match="Authorization header must be 'Bearer <token>'"
        ):
            extract_bearer_token(malformed_header)

    def test_handles_multiple_whitespace(self):
        header = "Bearer    spaced-out-token"
        assert extract_bearer_token(header) == "spaced-out-token"
