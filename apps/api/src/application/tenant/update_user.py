"""
UpdateUser application use case.
Validates ownership and updates user name.
"""

from __future__ import annotations
from dataclasses import replace
from typing import Protocol

from domain.tenant.models import Tenant, TenantUser


class TenantRepo(Protocol):
    def get_tenant(self, tenant_id: str) -> Tenant | None: ...


class TenantUserRepo(Protocol):
    def get_user(
        self, tenant_id: str, user_id: str
    ) -> TenantUser | None: ...

    def save_user(self, user: TenantUser) -> None: ...


class UpdateUser:
    def __init__(
        self,
        tenant_repo: TenantRepo,
        user_repo: TenantUserRepo,
    ) -> None:
        self._tenant_repo = tenant_repo
        self._user_repo = user_repo

    def execute(
        self,
        requesting_user_id: str,
        tenant_id: str,
        user_id: str,
        name: str,
    ) -> TenantUser:
        tenant = self._tenant_repo.get_tenant(tenant_id)
        if not tenant:
            raise ValueError(f"Tenant not found: {tenant_id}")

        if not tenant.is_owner(requesting_user_id):
            raise PermissionError("Only tenant owner can update users")

        user = self._user_repo.get_user(tenant_id, user_id)
        if not user:
            raise ValueError("User not found")

        updated_user = replace(user, name=name)
        self._user_repo.save_user(updated_user)

        return updated_user
