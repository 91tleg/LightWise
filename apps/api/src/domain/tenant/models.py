from dataclasses import dataclass
from typing import Optional


@dataclass
class Tenant:
    tenant_id: str
    name: Optional[str] = None
    metadata: Optional[dict] = None
