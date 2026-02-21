from dataclasses import dataclass


@dataclass(frozen=True)
class IoTUplink:
    dev_eui: str
    payload_b64: str
