"""
InviteUser application use case.
Validates ownership and user cap, creates the Cognito user,
and persists the TenantUser record.
"""

from __future__ import annotations
from datetime import datetime, timezone
from typing import Protocol

from domain.tenant.models import Tenant, TenantUser


class TenantRepo(Protocol):
    def get_tenant(self, tenant_id: str) -> Tenant | None: ...


class TenantUserRepo(Protocol):
    def count_users(self, tenant_id: str) -> int: ...
    def save_user(self, user: TenantUser) -> None: ...


class CognitoAdmin(Protocol):
    def create_cognito_user(
        self,
        user_pool_id: str,
        email: str,
        tenant_id: str,
        role: str,
    ) -> str: ...


class InviteUser:
    def __init__(
        self,
        tenant_repo: TenantRepo,
        user_repo: TenantUserRepo,
        cognito: CognitoAdmin,
        user_pool_id: str,
    ) -> None:
        self._tenant_repo = tenant_repo
        self._user_repo = user_repo
        self._cognito = cognito
        self._user_pool_id = user_pool_id

    def execute(
        self,
        requesting_user_id: str,
        tenant_id: str,
        email: str,
        role: str,
    ) -> TenantUser:
        tenant = self._tenant_repo.get_tenant(tenant_id)
        if not tenant:
            raise ValueError(f"Tenant not found: {tenant_id}")

        if not tenant.is_owner(requesting_user_id):
            raise PermissionError("Only the tenant owner can invite users")

        current_count = self._user_repo.count_users(tenant_id)
        if not tenant.can_invite(current_count):
            raise ValueError(
                f"User cap reached: maximum {tenant.max_users} users allowed"
            )

        sub = self._cognito.create_cognito_user(
            user_pool_id=self._user_pool_id,
            email=email,
            tenant_id=tenant_id,
            role=role,
        )

        user = TenantUser(
            tenant_id=tenant_id,
            user_id=sub,
            email=email,
            role=role,
            created_at=datetime.now(timezone.utc).isoformat(),
        )
        self._user_repo.save_user(user)
        return user
    