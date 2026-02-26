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

    def to_dict(self) -> dict:
        return {
            "tenant_id": self.tenant_id,
            "user_id": self.user_id,
            "email": self.email,
            "role": self.role,
            "created_at": self.created_at,
        }
