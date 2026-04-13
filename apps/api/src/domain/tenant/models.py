from dataclasses import dataclass


@dataclass(frozen=True)
class Tenant:
    tenant_id: str
    name: str
    created_at: str


@dataclass(frozen=True)
class TenantUser:
    tenant_id: str
    user_id: str
    email: str
    role: str
    created_at: str
