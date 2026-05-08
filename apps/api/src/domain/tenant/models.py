from dataclasses import dataclass


@dataclass(frozen=True)
class Tenant:
    tenant_id: str
    name: str
    owner_user_id: str
    max_users: int
    created_at: str

    def can_invite(self, current_user_count: int) -> bool:
        return current_user_count < self.max_users

    def is_owner(self, user_id: str) -> bool:
        return self.owner_user_id == user_id


@dataclass(frozen=True)
class TenantUser:
    tenant_id: str
    user_id: str
    email: str
    role: str
    created_at: str
