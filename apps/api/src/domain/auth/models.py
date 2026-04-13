from __future__ import annotations
from dataclasses import dataclass


@dataclass(frozen=True)
class OperatorProfile:
    """
    Verified operator identity returned to the frontend.
    Derived from Cognito claims.
    """
    sub:        str
    tenant_id:  str
    first_name: str
    last_name:  str
    email:      str
    role:       str  # "admin" | "operator"

    @property
    def full_name(self) -> str:
        return f"{self.first_name.strip()} {self.last_name.strip()}".strip()
