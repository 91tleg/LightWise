import json
from types import SimpleNamespace
from unittest.mock import patch

from domain.errors import AuthError
from infrastructure.handlers.user_invite import handler


def _event(body=None):
    return {
        "body": json.dumps(
            body
            if body is not None
            else {"email": "new.user@example.com", "role": "operator"}
        )
    }


class TestInviteUserHandler:
    def test_passes_tenant_and_requesting_user_to_use_case(self):
        user = SimpleNamespace(
            user_id="user-2",
            name="",
            email="new.user@example.com",
            role="operator",
            tenant_id="tenant-1",
            created_at="2026-05-12T00:00:00+00:00",
        )

        with patch(
            "infrastructure.handlers.user_invite.resolve_identity",
            return_value=("tenant-1", "owner-1"),
        ), patch("infrastructure.handlers.user_invite._use_case") as mock_uc:
            mock_uc.return_value.execute.return_value = user
            response = handler(_event(), None)

        assert response["statusCode"] == 201
        mock_uc.return_value.execute.assert_called_once_with(
            requesting_user_id="owner-1",
            tenant_id="tenant-1",
            email="new.user@example.com",
            role="operator",
        )

    def test_returns_401_on_auth_error(self):
        with patch(
            "infrastructure.handlers.user_invite.resolve_identity",
            side_effect=AuthError("bad token"),
        ):
            response = handler(_event(), None)

        assert response["statusCode"] == 401

    def test_returns_400_for_missing_email(self):
        with patch(
            "infrastructure.handlers.user_invite.resolve_identity",
            return_value=("tenant-1", "owner-1"),
        ), patch("infrastructure.handlers.user_invite._use_case") as mock_uc:
            response = handler(_event({"role": "operator"}), None)

        assert response["statusCode"] == 400
        mock_uc.return_value.execute.assert_not_called()
