import json
from unittest.mock import patch

from application.streetlight.send_command import (
    InvalidCommandError,
    InvalidCommandParamsError,
    SentStreetlightCommand,
    StreetlightNotFoundError,
)
from domain.errors import AuthError
from infrastructure.handlers.streetlights_send_command import handler


def _event(body: str = '{"command": "SET_LEVELS", "params": {}}') -> dict:
    return {
        "pathParameters": {"id": "sl-001"},
        "body": body,
    }


class TestSendCommandHandler:
    def _call(
        self,
        event: dict,
        identity=("tenant-1", "user-1"),
        result=SentStreetlightCommand(
            command_id="cmd-1",
            streetlight_id="sl-001",
            command="SET_LEVELS",
        ),
    ):
        with patch(
            "infrastructure.handlers.streetlights_send_command"
            ".resolve_identity",
            return_value=identity,
        ), patch(
            "infrastructure.handlers.streetlights_send_command._use_case"
        ) as mock_uc:
            mock_uc.return_value.execute.return_value = result
            return handler(event, None), mock_uc

    def test_passes_decoded_request_to_use_case(self):
        response, mock_uc = self._call(
            _event(
                json.dumps(
                    {
                        "command": "SET_LEVELS",
                        "params": {"max_level": 90, "dim_level": 20},
                    }
                )
            )
        )

        assert response["statusCode"] == 202
        mock_uc.return_value.execute.assert_called_once_with(
            tenant_id="tenant-1",
            issued_by="user-1",
            streetlight_id="sl-001",
            command="SET_LEVELS",
            params={"max_level": 90, "dim_level": 20},
        )

    def test_returns_401_on_auth_error(self):
        with patch(
            "infrastructure.handlers.streetlights_send_command"
            ".resolve_identity",
            side_effect=AuthError("bad token"),
        ):
            response = handler(_event(), None)

        assert response["statusCode"] == 401

    def test_returns_400_for_invalid_request_shape(self):
        response, mock_uc = self._call(
            {"pathParameters": {"id": "sl-001"}, "body": "{bad json"}
        )

        assert response["statusCode"] == 400
        mock_uc.return_value.execute.assert_not_called()

    def test_maps_invalid_command_to_400(self):
        with patch(
            "infrastructure.handlers.streetlights_send_command"
            ".resolve_identity",
            return_value=("tenant-1", "user-1"),
        ), patch(
            "infrastructure.handlers.streetlights_send_command._use_case"
        ) as mock_uc:
            mock_uc.return_value.execute.side_effect = InvalidCommandError(
                "Invalid command"
            )
            response = handler(_event(), None)

        assert response["statusCode"] == 400

    def test_maps_invalid_command_params_to_422(self):
        with patch(
            "infrastructure.handlers.streetlights_send_command"
            ".resolve_identity",
            return_value=("tenant-1", "user-1"),
        ), patch(
            "infrastructure.handlers.streetlights_send_command._use_case"
        ) as mock_uc:
            mock_uc.return_value.execute.side_effect = (
                InvalidCommandParamsError("bad params")
            )
            response = handler(_event(), None)

        assert response["statusCode"] == 422

    def test_maps_missing_streetlight_to_404(self):
        with patch(
            "infrastructure.handlers.streetlights_send_command"
            ".resolve_identity",
            return_value=("tenant-1", "user-1"),
        ), patch(
            "infrastructure.handlers.streetlights_send_command._use_case"
        ) as mock_uc:
            mock_uc.return_value.execute.side_effect = (
                StreetlightNotFoundError("Streetlight not found")
            )
            response = handler(_event(), None)

        assert response["statusCode"] == 404
