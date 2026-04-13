from datetime import datetime, timezone
from unittest.mock import patch

from infrastructure.handlers.websocket_connect import handler
from domain.errors import AuthError
from domain.websocket.models import WebSocketConnection


_NOW = datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc)

_CONNECTION = WebSocketConnection(
    tenant_id="tenant-1",
    user_id="user-123",
    connection_id="conn-abc",
    connected_at=_NOW,
)


def _connect_event(connection_id: str = "conn-abc") -> dict:
    return {
        "requestContext": {
            "connectionId": connection_id,
            "authorizer": {
                "tenant_id": "tenant-1",
                "user_id": "user-123",
                "selected_protocol": "Bearer",
            },
        }
    }


class TestConnectHandler:
    def _call(
        self,
        event: dict,
        use_case_return=_CONNECTION,
        identity=("tenant-1", "user-123")
    ):
        with patch(
            "infrastructure.handlers.websocket_connect"
            ".extract_websocket_identity", return_value=identity), \
                patch(
                    "infrastructure.handlers.websocket_connect._use_case"
                ) as mock_uc:
            mock_uc.return_value.execute.return_value = use_case_return
            return handler(event, None), mock_uc

    def test_returns_200_on_success(self):
        response, _ = self._call(_connect_event())
        assert response["statusCode"] == 200

    def test_echoes_selected_protocol_header(self):
        response, _ = self._call(_connect_event())
        assert response["headers"]["Sec-WebSocket-Protocol"] == "Bearer"

    def test_passes_correct_args_to_use_case(self):
        _, mock_uc = self._call(_connect_event())
        mock_uc.return_value.execute.assert_called_once_with(
            connection_id="conn-abc",
            tenant_id="tenant-1",
            user_id="user-123",
        )

    def test_returns_401_on_auth_error(self):
        with patch(
            "infrastructure.handlers.websocket_connect"
            ".extract_websocket_identity", side_effect=AuthError("bad")), \
             patch("infrastructure.handlers.websocket_connect._use_case"):
            response = handler(_connect_event(), None)
        assert response["statusCode"] == 401

    def test_returns_500_on_unexpected_error(self):
        with patch(
            "infrastructure.handlers.websocket_connect"
            ".extract_websocket_identity", return_value=("t", "u")), \
                patch(
                    "infrastructure.handlers.websocket_connect._use_case"
                ) as mock_uc:
            mock_uc.return_value.execute.side_effect = RuntimeError("boom")
            response = handler(_connect_event(), None)
        assert response["statusCode"] == 500

    def test_falls_back_to_bearer_when_protocol_missing(self):
        event = _connect_event()
        del event["requestContext"]["authorizer"]["selected_protocol"]
        response, _ = self._call(event)
        assert response["headers"]["Sec-WebSocket-Protocol"] == "Bearer"
