from datetime import datetime, timezone
from unittest.mock import patch

from infrastructure.handlers.websocket_subscribe import handler
from domain.errors import AuthError
from domain.websocket.models import WebSocketConnection


_NOW = datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc)

_CONNECTION = WebSocketConnection(
    tenant_id="tenant-1",
    user_id="user-123",
    connection_id="conn-abc",
    connected_at=_NOW,
)


def _subscribe_event(
    connection_id: str = "conn-abc",
    body: str = '{"action": "subscribe", "streetlight_id": "sl-001"}',
) -> dict:
    return {
        "requestContext": {
            "connectionId": connection_id,
            "authorizer": {
                "tenant_id": "tenant-1",
                "user_id": "user-123",
            },
        },
        "body": body,
    }


class TestSubscribeHandler:
    def _call(
        self,
        event: dict,
        use_case_return=_CONNECTION,
        identity=("tenant-1", "user-123"),
        streetlight_id="sl-001",
    ):
        with patch(
            "infrastructure.handlers.websocket_subscribe"
            ".extract_websocket_identity", return_value=identity), \
                patch(
                    "infrastructure.handlers.websocket_subscribe"
                    "._parse_streetlight_id", return_value=streetlight_id
                ), \
                patch(
                    "infrastructure.handlers.websocket_subscribe"
                    "._use_case"
                ) as mock_uc:
            mock_uc.return_value.execute.return_value = use_case_return
            return handler(event, None), mock_uc

    def test_returns_200_on_success(self):
        response, _ = self._call(_subscribe_event())
        assert response["statusCode"] == 200
        assert response["body"] == "subscribed"

    def test_passes_correct_args_to_use_case(self):
        _, mock_uc = self._call(_subscribe_event())
        mock_uc.return_value.execute.assert_called_once_with(
            connection_id="conn-abc",
            tenant_id="tenant-1",
            user_id="user-123",
            streetlight_id="sl-001",
        )

    def test_returns_401_on_auth_error(self):
        with patch(
            "infrastructure.handlers.websocket_subscribe"
            ".extract_websocket_identity", side_effect=AuthError("bad")), \
                patch(
                    "infrastructure.handlers.websocket_subscribe."
                    "_parse_streetlight_id", return_value="sl-001"), \
                patch(
                    "infrastructure.handlers.websocket_subscribe._use_case"
                ):
            response = handler(_subscribe_event(), None)
        assert response["statusCode"] == 401

    def test_returns_400_on_missing_streetlight_id(self):
        with patch(
            "infrastructure.handlers.websocket_subscribe"
            ".extract_websocket_identity", return_value=("t", "u")), \
             patch(
                "infrastructure.handlers.websocket_subscribe"
                "._parse_streetlight_id", side_effect=ValueError(
                    "streetlight_id is required"
                )
            ), \
             patch("infrastructure.handlers.websocket_subscribe._use_case"):
            response = handler(_subscribe_event(body="{}"), None)
        assert response["statusCode"] == 400
        assert "streetlight_id" in response["body"]

    def test_returns_500_on_unexpected_error(self):
        with patch(
            "infrastructure.handlers.websocket_subscribe"
            ".extract_websocket_identity", return_value=("t", "u")), \
                patch(
                    "infrastructure.handlers.websocket_subscribe"
                    "._parse_streetlight_id", return_value="sl-001"
                ), \
                patch(
                    "infrastructure.handlers.websocket_subscribe"
                    "._use_case"
                ) as mock_uc:
            mock_uc.return_value.execute.side_effect = RuntimeError("boom")
            response = handler(_subscribe_event(), None)
        assert response["statusCode"] == 500
