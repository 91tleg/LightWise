from dataclasses import dataclass


@dataclass(frozen=True)
class IoTUplink:
    streetlight_id: str
    tenant_id: str
    site_id: str
    payload_bytes: bytes
