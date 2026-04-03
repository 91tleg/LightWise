from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime


@dataclass(frozen=True)
class IoTUplink:
    """
    Parsed IoT Core rule event with resolved device identity.
    """
    streetlight_id: str
    tenant_id: str
    site_id: str
    payload_bytes: bytes
    received_at: datetime
    rssi: int | None = None
    snr: float | None = None
