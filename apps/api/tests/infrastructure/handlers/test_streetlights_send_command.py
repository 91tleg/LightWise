import json
from unittest.mock import patch

from application.streetlight.send_command import (
    DispatchedCommand,
    InvalidCommandError,
    InvalidCommandParamsError,
    MissingWirelessDeviceIdError,
    StreetlightNotFoundError,
)
from domain.errors import AuthError
from infrastructure.handlers.streetlights_send_command import handler
from infrastructure.lorawan.iot_core import DispatchError

_PATCH_RESOLVE_IDENTITY = (
    "infrastructure.handlers.streetlights_send_command.resolve_identity"
)
_PATCH_USE_CASE = (
    "infrastructure.handlers.streetlights_send_command._use_case"
)
_DEFAULT_EVENT_BODY = (
    '{"command": "SET_LEVELS", '
    '"params": {"max_level": 90, "dim_level": 20}}'
)


def _event(
    body: str = _DEFAULT_EVENT_BODY,
    streetlight_id: str = "sl-001",
) -> dict:
    return {
        "requestContext": {
            "authorizer": {
                "claims": {
                    "custom:tenant_id": "tenant-1",
                    "sub": "user-1",
                }
            }
        },
        "pathParameters": {"id": streetlight_id},
        "body": body,
    }


_DEFAULT_RESULT = DispatchedCommand(
    command_id="cmd-1",
    streetlight_id="sl-001",
    command="SET_LEVELS",
)


class TestSendCommandHandler:
    def _call(
        self,
        event: dict,
        identity=("tenant-1", "user-1"),
        result=_DEFAULT_RESULT,
    ):
        with patch(
            _PATCH_RESOLVE_IDENTITY,
            return_value=identity,
        ), patch(
            _PATCH_USE_CASE
        ) as mock_uc:
            mock_uc.return_value.execute.return_value = result
            return handler(event, None), mock_uc

    def test_returns_202_on_success(self):
        response, _ = self._call(_event())
        assert response["statusCode"] == 202

    def test_response_body_contains_required_fields(self):
        response, _ = self._call(_event())
        body = json.loads(response["body"])
        assert body["command_id"] == "cmd-1"
        assert body["streetlight_id"] == "sl-001"
        assert body["command"] == "SET_LEVELS"
        assert body["status"] == "pending"
        assert "dispatched_at" in body

    def test_passes_correct_args_to_use_case(self):
        command_event = _event(json.dumps({
            "command": "SET_LEVELS",
            "params": {"max_level": 90, "dim_level": 20},
        }))
        _, mock_uc = self._call(command_event)
        mock_uc.return_value.execute.assert_called_once_with(
            tenant_id="tenant-1",
            issued_by="user-1",
            streetlight_id="sl-001",
            command="SET_LEVELS",
            params={"max_level": 90, "dim_level": 20},
        )

    def test_returns_401_on_auth_error(self):
        with patch(
            _PATCH_RESOLVE_IDENTITY,
            side_effect=AuthError("bad token"),
        ):
            response = handler(_event(), None)
        assert response["statusCode"] == 401

    def test_returns_400_for_invalid_json(self):
        response, mock_uc = self._call(
            _event(body="{bad json")
        )
        assert response["statusCode"] == 400
        mock_uc.return_value.execute.assert_not_called()

    def test_returns_400_for_missing_streetlight_id(self):
        event = _event()
        event["pathParameters"] = {}
        response, mock_uc = self._call(event)
        assert response["statusCode"] == 400
        mock_uc.return_value.execute.assert_not_called()

    def test_returns_400_for_missing_command(self):
        response, mock_uc = self._call(
            _event(body=json.dumps({"params": {}}))
        )
        assert response["statusCode"] == 400
        mock_uc.return_value.execute.assert_not_called()

    def test_returns_400_for_non_dict_params(self):
        response, mock_uc = self._call(
            _event(body=json.dumps({"command": "SET_LEVELS", "params": "bad"}))
        )
        assert response["statusCode"] == 400
        mock_uc.return_value.execute.assert_not_called()

    def test_maps_invalid_command_to_400(self):
        with patch(
            _PATCH_RESOLVE_IDENTITY,
            return_value=("tenant-1", "user-1"),
        ), patch(
            _PATCH_USE_CASE
        ) as mock_uc:
            mock_uc.return_value.execute.side_effect = InvalidCommandError(
                "Invalid command"
            )
            response = handler(_event(), None)
        assert response["statusCode"] == 400

    def test_maps_invalid_params_to_422(self):
        with patch(
            _PATCH_RESOLVE_IDENTITY,
            return_value=("tenant-1", "user-1"),
        ), patch(
            _PATCH_USE_CASE
        ) as mock_uc:
            mock_uc.return_value.execute.side_effect = (
                InvalidCommandParamsError("bad params")
            )
            response = handler(_event(), None)
        assert response["statusCode"] == 422

    def test_maps_streetlight_not_found_to_404(self):
        with patch(
            _PATCH_RESOLVE_IDENTITY,
            return_value=("tenant-1", "user-1"),
        ), patch(
            _PATCH_USE_CASE
        ) as mock_uc:
            mock_uc.return_value.execute.side_effect = (
                StreetlightNotFoundError("not found")
            )
            response = handler(_event(), None)
        assert response["statusCode"] == 404

    def test_maps_missing_wireless_device_to_400(self):
        with patch(
            _PATCH_RESOLVE_IDENTITY,
            return_value=("tenant-1", "user-1"),
        ), patch(
            _PATCH_USE_CASE
        ) as mock_uc:
            mock_uc.return_value.execute.side_effect = (
                MissingWirelessDeviceIdError("missing")
            )
            response = handler(_event(), None)
        assert response["statusCode"] == 400

    def test_maps_dispatch_error_to_500(self):
        with patch(
            _PATCH_RESOLVE_IDENTITY,
            return_value=("tenant-1", "user-1"),
        ), patch(
            _PATCH_USE_CASE
        ) as mock_uc:
            mock_uc.return_value.execute.side_effect = DispatchError(
                "iot core failed"
            )
            response = handler(_event(), None)
        assert response["statusCode"] == 500

    def test_maps_unexpected_error_to_500(self):
        with patch(
            _PATCH_RESOLVE_IDENTITY,
            return_value=("tenant-1", "user-1"),
        ), patch(
            _PATCH_USE_CASE
        ) as mock_uc:
            mock_uc.return_value.execute.side_effect = RuntimeError(
                "unexpected"
            )
            response = handler(_event(), None)
        assert response["statusCode"] == 500
