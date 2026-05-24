from __future__ import annotations
from unittest.mock import MagicMock
import pytest

from application.tenant.remove_user import RemoveUser
from domain.tenant.models import Tenant, TenantUser


_TENANT = Tenant(
    tenant_id="tenant-1",
    name="Acme Lighting",
    owner_user_ids=frozenset(["owner-1", "owner-2"]),
    max_users=3,
    created_at="2024-01-01T00:00:00+00:00",
)

_TARGET_USER = TenantUser(
    tenant_id="tenant-1",
    user_id="user-2",
    email="target@example.com",
    role="operator",
    created_at="2024-01-01T00:00:00+00:00",
)


def _use_case(
    tenant: Tenant | None = _TENANT,
    user: TenantUser | None = _TARGET_USER,
) -> tuple[RemoveUser, MagicMock, MagicMock, MagicMock]:
    tenant_repo = MagicMock()
    tenant_repo.get_tenant.return_value = tenant
    user_repo = MagicMock()
    user_repo.get_user.return_value = user
    cognito = MagicMock()
    return (
        RemoveUser(
            tenant_repo=tenant_repo,
            user_repo=user_repo,
            cognito=cognito,
            user_pool_id="pool-1",
        ),
        tenant_repo,
        user_repo,
        cognito,
    )


class TestRemoveUserSuccess:
    def test_deletes_cognito_user_and_tenant_user(self):
        use_case, tenant_repo, user_repo, cognito = _use_case()

        result = use_case.execute(
            requesting_user_id="owner-1",
            tenant_id="tenant-1",
            user_id="user-2",
        )

        assert result is None
        tenant_repo.get_tenant.assert_called_once_with("tenant-1")
        user_repo.get_user.assert_called_once_with("tenant-1", "user-2")
        cognito.delete_cognito_user.assert_called_once_with(
            user_pool_id="pool-1",
            email="target@example.com",
        )
        user_repo.delete_user.assert_called_once_with("tenant-1", "user-2")

    def test_second_owner_can_remove_user(self):  # new
        use_case, _, user_repo, cognito = _use_case()
        result = use_case.execute(
            requesting_user_id="owner-2",
            tenant_id="tenant-1",
            user_id="user-2",
        )
        assert result is None
        cognito.delete_cognito_user.assert_called_once()
        user_repo.delete_user.assert_called_once()

    def test_owner_can_remove_other_owner(self):
        other_owner = TenantUser(
            tenant_id="tenant-1",
            user_id="owner-2",
            email="owner2@example.com",
            role="admin",
            created_at="2024-01-01T00:00:00+00:00",
        )
        use_case, _, user_repo, cognito = _use_case(user=other_owner)
        result = use_case.execute(
            requesting_user_id="owner-1",
            tenant_id="tenant-1",
            user_id="owner-2",
        )
        assert result is None
        cognito.delete_cognito_user.assert_called_once()
        user_repo.delete_user.assert_called_once()


class TestRemoveUserValidation:
    def test_raises_when_tenant_not_found(self):
        use_case, _, user_repo, cognito = _use_case(tenant=None)

        with pytest.raises(ValueError, match="Tenant not found"):
            use_case.execute(
                requesting_user_id="owner-1",
                tenant_id="missing-tenant",
                user_id="user-2",
            )

        user_repo.get_user.assert_not_called()
        cognito.delete_cognito_user.assert_not_called()
        user_repo.delete_user.assert_not_called()

    def test_raises_when_requesting_user_is_not_owner(self):
        use_case, _, user_repo, cognito = _use_case()
        with pytest.raises(PermissionError, match="Only a tenant owner"):
            use_case.execute(
                requesting_user_id="member-1",
                tenant_id="tenant-1",
                user_id="user-2",
            )

        user_repo.get_user.assert_not_called()
        cognito.delete_cognito_user.assert_not_called()
        user_repo.delete_user.assert_not_called()

    def test_raises_when_owner_removes_self(self):
        use_case, _, user_repo, cognito = _use_case()

        with pytest.raises(
            ValueError, match="Owner cannot remove themselves"
        ):
            use_case.execute(
                requesting_user_id="owner-1",
                tenant_id="tenant-1",
                user_id="owner-1",
            )

        user_repo.get_user.assert_not_called()
        cognito.delete_cognito_user.assert_not_called()
        user_repo.delete_user.assert_not_called()

    def test_raises_when_user_not_found(self):
        use_case, _, user_repo, cognito = _use_case(user=None)

        with pytest.raises(ValueError, match="User not found"):
            use_case.execute(
                requesting_user_id="owner-1",
                tenant_id="tenant-1",
                user_id="missing-user",
            )

        user_repo.get_user.assert_called_once_with(
            "tenant-1", "missing-user"
        )
        cognito.delete_cognito_user.assert_not_called()
        user_repo.delete_user.assert_not_called()
