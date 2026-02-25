from dataclasses import dataclass
from typing import Optional


@dataclass(frozen=True)
class Tenant:
    tenant_id: str
    name: Optional[str] = None
    metadata: Optional[dict] = None


@dataclass(frozen=True)
class TenantUser:
    tenant_id: str
    user_id: str
    email: str
    role: str
    created_at: str
