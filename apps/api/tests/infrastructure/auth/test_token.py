from infrastructure.auth.token import (
    extract_websocket_auth,
    extract_websocket_token,
)


def _event(header_value: str | None) -> dict:
    if header_value is None:
        return {}
    return {"headers": {"Sec-WebSocket-Protocol": header_value}}


class TestExtractWebsocketToken:
    def test_valid_bearer_token(self):
        token = extract_websocket_token(_event("Bearer, abc123"))
        assert token == "abc123"

    def test_returns_selected_bearer_protocol(self):
        auth = extract_websocket_auth(_event("Bearer, abc123"))
        assert auth.token == "abc123"
        assert auth.selected_protocol == "Bearer"

    def test_strips_whitespace(self):
        token = extract_websocket_token(_event("Bearer,   abc123  "))
        assert token == "abc123"

    def test_header_lookup_is_case_insensitive(self):
        event = {"headers": {"sec-websocket-protocol": "Bearer, abc123"}}
        assert extract_websocket_token(event) == "abc123"

    def test_token_only_protocol(self):
        auth = extract_websocket_auth(_event("abc123"))
        assert auth.token == "abc123"
        assert auth.selected_protocol == "abc123"

    def test_missing_headers(self):
        assert extract_websocket_token({}) is None

    def test_none_headers(self):
        assert extract_websocket_token({"headers": None}) is None

    def test_missing_protocol_header(self):
        assert extract_websocket_token({"headers": {}}) is None

    def test_wrong_scheme(self):
        assert extract_websocket_token(_event("Basic, abc123")) is None

    def test_empty_header(self):
        assert extract_websocket_token(_event("")) is None

    def test_too_many_parts(self):
        assert extract_websocket_token(
            _event("Bearer, abc123, extra")
        ) is None

    def test_bearer_no_token(self):
        assert extract_websocket_token(_event("Bearer,")) is None
