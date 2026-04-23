"""
RemoveUser application use case.
Validates ownership, deletes the Cognito user,
and removes the TenantUser record.
"""

from __future__ import annotations
from typing import Protocol

from domain.tenant.models import Tenant, TenantUser


class TenantRepo(Protocol):
    def get_tenant(self, tenant_id: str) -> Tenant | None: ...


class TenantUserRepo(Protocol):
    def get_user(
            self, tenant_id: str, user_id: str
    ) -> TenantUser | None: ...

    def delete_user(
        self, tenant_id: str, user_id: str
    ) -> None: ...


class CognitoAdmin(Protocol):
    def delete_cognito_user(self, user_pool_id: str, email: str) -> None: ...


class RemoveUser:
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
        user_id: str,
    ) -> None:
        tenant = self._tenant_repo.get_tenant(tenant_id)
        if not tenant:
            raise ValueError(f"Tenant not found: {tenant_id}")

        if not tenant.is_owner(requesting_user_id):
            raise PermissionError(
                "Only the tenant owner can remove users"
            )

        if requesting_user_id == user_id:
            raise ValueError("Owner cannot remove themselves")

        user = self._user_repo.get_user(tenant_id, user_id)
        if not user:
            raise ValueError(f"User not found: {user_id}")

        self._cognito.delete_cognito_user(
            user_pool_id=self._user_pool_id,
            email=user.email,
        )
        self._user_repo.delete_user(tenant_id, user_id)
        
        
        