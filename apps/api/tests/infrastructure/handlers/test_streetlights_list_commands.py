import json
from decimal import Decimal
from unittest.mock import patch

from domain.errors import AuthError
from infrastructure.handlers.streetlights_list_commands import handler
from infrastructure.persistence.error import PersistenceError

_PATCH_RESOLVE_IDENTITY = (
    "infrastructure.handlers.streetlights_list_commands.resolve_identity"
)
_PATCH_COMMAND_REPO = (
    "infrastructure.handlers.streetlights_list_commands._command_repo"
)


def _event(streetlight_id="sl-001", query=None):
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
        "queryStringParameters": query,
    }


class TestListCommandsHandler:
    def _call(self, event, items=None, identity=("tenant-1", "user-1")):
        with patch(
            _PATCH_RESOLVE_IDENTITY,
            return_value=identity,
        ), patch(_PATCH_COMMAND_REPO) as mock_repo:
            mock_repo.return_value.list_for_streetlight.return_value = items or []
            return handler(event, None), mock_repo

    def test_returns_command_history(self):
        response, _ = self._call(
            _event(query={"limit": "5"}),
            items=[
                {
                    "command_id": "cmd-1",
                    "streetlight_id": "sl-001",
                    "command_type": "SET_LEVELS",
                    "payload": {
                        "max_level": Decimal("90"),
                        "dim_level": Decimal("20"),
                    },
                    "status": "ACKNOWLEDGED",
                    "sent_at": "2026-05-13T01:00:00+00:00",
                    "acknowledged_at": "2026-05-13T01:00:02+00:00",
                    "reason": "OK",
                }
            ],
        )

        assert response["statusCode"] == 200
        body = json.loads(response["body"])
        assert body["streetlight_id"] == "sl-001"
        assert body["commands"] == [
            {
                "command_id": "cmd-1",
                "streetlight_id": "sl-001",
                "command": "SET_LEVELS",
                "params": {"max_level": 90, "dim_level": 20},
                "status": "ACKNOWLEDGED",
                "dispatched_at": "2026-05-13T01:00:00+00:00",
                "response": {
                    "received_at": "2026-05-13T01:00:02+00:00",
                    "response_code": "ACK",
                    "reason_code": "OK",
                },
            }
        ]

    def test_passes_tenant_streetlight_and_limit_to_repo(self):
        _, mock_repo = self._call(_event(query={"limit": "7"}))
        mock_repo.return_value.list_for_streetlight.assert_called_once_with(
            streetlight_id="sl-001",
            tenant_id="tenant-1",
            limit=7,
        )

    def test_returns_400_for_missing_streetlight_id(self):
        event = _event()
        event["pathParameters"] = {}
        response, mock_repo = self._call(event)
        assert response["statusCode"] == 400
        mock_repo.return_value.list_for_streetlight.assert_not_called()

    def test_returns_400_for_invalid_limit(self):
        response, mock_repo = self._call(_event(query={"limit": "zero"}))
        assert response["statusCode"] == 400
        mock_repo.return_value.list_for_streetlight.assert_not_called()

    def test_caps_large_limit(self):
        _, mock_repo = self._call(_event(query={"limit": "500"}))
        assert mock_repo.return_value.list_for_streetlight.call_args.kwargs["limit"] == 100

    def test_returns_401_on_auth_error(self):
        with patch(
            _PATCH_RESOLVE_IDENTITY,
            side_effect=AuthError("bad token"),
        ):
            response = handler(_event(), None)
        assert response["statusCode"] == 401

    def test_maps_persistence_error_to_500(self):
        with patch(
            _PATCH_RESOLVE_IDENTITY,
            return_value=("tenant-1", "user-1"),
        ), patch(_PATCH_COMMAND_REPO) as mock_repo:
            mock_repo.return_value.list_for_streetlight.side_effect = (
                PersistenceError("down")
            )
            response = handler(_event(), None)
        assert response["statusCode"] == 500
