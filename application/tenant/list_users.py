"""
ListUsers application use case.
Returns all users belonging to a tenant.
"""

from __future__ import annotations
from typing import Protocol

from domain.tenant.models import TenantUser


class TenantUserRepo(Protocol):
    def list_users(self, tenant_id: str) -> list[TenantUser]: ...


class ListUsers:
    def __init__(self, user_repo: TenantUserRepo) -> None:
        self._user_repo = user_repo

    def execute(self, tenant_id: str) -> list[TenantUser]:
        return self._user_repo.list_users(tenant_id)