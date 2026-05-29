from __future__ import annotations
from datetime import datetime
from unittest.mock import MagicMock
import pytest

from application.tenant.invite_user import InviteUser
from domain.tenant.models import Tenant


_TENANT = Tenant(
    tenant_id="tenant-1",
    name="Acme Lighting",
    owner_user_ids=frozenset(["owner-1", "owner-2"]),
    max_users=3,
    created_at="2024-01-01T00:00:00+00:00",
)


def _use_case(
    tenant: Tenant | None = _TENANT,
    user_count: int = 1,
    cognito_sub: str = "user-2",
) -> tuple[InviteUser, MagicMock, MagicMock, MagicMock]:
    tenant_repo = MagicMock()
    tenant_repo.get_tenant.return_value = tenant
    user_repo = MagicMock()
    user_repo.count_users.return_value = user_count
    cognito = MagicMock()
    cognito.create_cognito_user.return_value = cognito_sub
    return (
        InviteUser(
            tenant_repo=tenant_repo,
            user_repo=user_repo,
            cognito=cognito,
            user_pool_id="pool-1",
        ),
        tenant_repo,
        user_repo,
        cognito,
    )


class TestInviteUserSuccess:
    def test_creates_cognito_user_and_persists_tenant_user(self):
        use_case, tenant_repo, user_repo, cognito = _use_case()

        result = use_case.execute(
            requesting_user_id="owner-1",
            tenant_id="tenant-1",
            email="new.user@example.com",
            role="operator",
        )

        assert result.tenant_id == "tenant-1"
        assert result.user_id == "user-2"
        assert result.email == "new.user@example.com"
        assert result.role == "operator"
        assert datetime.fromisoformat(result.created_at).tzinfo is not None
        tenant_repo.get_tenant.assert_called_once_with("tenant-1")
        user_repo.count_users.assert_called_once_with("tenant-1")
        cognito.create_cognito_user.assert_called_once_with(
            user_pool_id="pool-1",
            email="new.user@example.com",
            tenant_id="tenant-1",
            role="operator",
        )
        user_repo.save_user.assert_called_once_with(result)

    def test_second_owner_can_invite(self):
        use_case, _, user_repo, cognito = _use_case()
        result = use_case.execute(
            requesting_user_id="owner-2",
            tenant_id="tenant-1",
            email="new.user@example.com",
            role="operator",
        )
        assert result.user_id == "user-2"
        cognito.create_cognito_user.assert_called_once()
        user_repo.save_user.assert_called_once()


class TestInviteUserValidation:
    def test_raises_when_tenant_not_found(self):
        use_case, _, user_repo, cognito = _use_case(tenant=None)

        with pytest.raises(ValueError, match="Tenant not found"):
            use_case.execute(
                requesting_user_id="owner-1",
                tenant_id="missing-tenant",
                email="new.user@example.com",
                role="operator",
            )

        user_repo.count_users.assert_not_called()
        cognito.create_cognito_user.assert_not_called()
        user_repo.save_user.assert_not_called()

    def test_raises_when_requesting_user_is_not_owner(self):
        use_case, _, user_repo, cognito = _use_case()
        with pytest.raises(PermissionError, match="Only a tenant owner"):
            use_case.execute(
                requesting_user_id="member-1",
                tenant_id="tenant-1",
                email="new.user@example.com",
                role="operator",
            )

        user_repo.count_users.assert_not_called()
        cognito.create_cognito_user.assert_not_called()
        user_repo.save_user.assert_not_called()

    def test_raises_when_user_cap_reached(self):
        use_case, _, user_repo, cognito = _use_case(user_count=3)

        with pytest.raises(ValueError, match="User cap reached"):
            use_case.execute(
                requesting_user_id="owner-1",
                tenant_id="tenant-1",
                email="new.user@example.com",
                role="operator",
            )

        user_repo.count_users.assert_called_once_with("tenant-1")
        cognito.create_cognito_user.assert_not_called()
        user_repo.save_user.assert_not_called()
