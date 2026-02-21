from typing import TypedDict, Union

class SensorPayloadBase(TypedDict):
    version: int


class SensorPayloadV1(TypedDict):
    lux: float
    temperature_c: int
    humidity: int
    motion: bool
    light_level: int

    # Sensor health flags
    ambient_primary_ok: bool = True
    ambient_secondary_ok: bool = True
    th_ok: bool = True
    motion_primary_ok: bool = True
    motion_secondary_ok: bool = True
    overall_ok: bool = True
    system_degraded: bool = False


SensorPayload = Union[
    SensorPayloadV1,
    # SensorPayloadV2,  # future
]
