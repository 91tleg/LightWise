from __future__ import annotations
from unittest.mock import MagicMock

from application.tenant.list_users import ListUsers
from domain.tenant.models import TenantUser


def _tenant_user(user_id: str, email: str) -> TenantUser:
    return TenantUser(
        tenant_id="tenant-1",
        user_id=user_id,
        email=email,
        role="operator",
        created_at="2024-01-01T00:00:00+00:00",
    )


def _use_case(
    users: list[TenantUser],
) -> tuple[ListUsers, MagicMock]:
    user_repo = MagicMock()
    user_repo.list_users.return_value = users
    return ListUsers(user_repo=user_repo), user_repo


class TestListUsers:
    def test_returns_users_from_repo(self):
        users = [
            _tenant_user("user-1", "one@example.com"),
            _tenant_user("user-2", "two@example.com"),
        ]
        use_case, _ = _use_case(users)

        result = use_case.execute("tenant-1")

        assert result == users

    def test_returns_empty_list_when_repo_has_no_users(self):
        use_case, _ = _use_case(users=[])

        assert use_case.execute("tenant-1") == []

    def test_repo_called_with_tenant_id(self):
        use_case, user_repo = _use_case(users=[])

        use_case.execute("tenant-abc")

        user_repo.list_users.assert_called_once_with("tenant-abc")
