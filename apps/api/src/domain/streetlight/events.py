"""
Streetlight event domain objects.

These represent inbound reports from a deployed streetlight —
what the device sent, decoded from the LoRaWAN wire format.

Three event types exist:

  TelemetryReport - sensor readings and health state.
                    Drives Timestream writes, DynamoDB state updates,
                    and WebSocket fanout.

  Heartbeat       — liveness signal with no sensor data.
                    Drives last_seen update only.

  CommandResponse — device ACK or NACK for a prior downlink command.
                    Drives DownlinkCommands status update only.

The union type StreetlightEvent covers all three and is used as the
return type of the uplink decoder and the input type of ProcessUplink.
"""

from __future__ import annotations
from dataclasses import dataclass
from datetime import datetime
from enum import IntEnum
from typing import Union

from domain.streetlight.health import SensorDiagnostics


@dataclass(frozen=True)
class SensorReadings:
    """
    Raw sensor measurements from a single telemetry report.
    """
    lux: float          # Ambient light level (normalized from lux_x10)
    temperature_c: int  # Signed degree celcius
    humidity: int       # Relative humidity 0–100%
    light_level: int    # Current light output 0–100%
    motion: bool        # Motion currently detected


@dataclass(frozen=True)
class TelemetryReport:
    """
    Decoded telemetry frame from a streetlight.

    Carries sensor readings and health diagnostics.
    The primary event type — drives all downstream processing.
    """
    streetlight_id: str
    tenant_id: str
    site_id: str
    timestamp: datetime
    readings: SensorReadings
    diagnostics: SensorDiagnostics

    def __post_init__(self) -> None:
        if self.timestamp.tzinfo is None:
            raise ValueError("timestamp must be timezone aware")

    @property
    def lux(self) -> float:
        return self.readings.lux

    @property
    def temperature_c(self) -> int:
        return self.readings.temperature_c

    @property
    def humidity(self) -> int:
        return self.readings.humidity

    @property
    def light_level(self) -> int:
        return self.readings.light_level

    @property
    def motion(self) -> bool:
        return self.readings.motion


@dataclass(frozen=True)
class Heartbeat:
    """
    Periodic liveness signal from a streetlight.

    Carries no sensor data. Signals the device is alive with no events
    to report. Drives last_seen update in DynamoDB.
    """
    streetlight_id: str
    tenant_id: str
    site_id: str
    timestamp: datetime

    def __post_init__(self) -> None:
        if self.timestamp.tzinfo is None:
            raise ValueError("timestamp must be timezone aware")


class ResponseCode(IntEnum):
    ACK = 0x00
    NACK = 0x01


class ReasonCode(IntEnum):
    OK = 0x00
    INVALID_VERSION = 0x01
    INVALID_CMD = 0x02
    INVALID_PARAM = 0x03
    NVS_ERROR = 0x04
    FSM_ERROR = 0x05
    PAYLOAD_TOO_SHORT = 0x06


@dataclass(frozen=True)
class CommandResponse:
    """
    Device response to a prior downlink command.

    echo_cmd is the raw CMD byte from the downlink being acknowledged.
    Kept as int rather than an enum so that NACKs for unknown commands
    are preserved without a decode error.

    Drives DownlinkCommands status update in DynamoDB.
    Not written to Timestream.
    """
    streetlight_id: str
    tenant_id: str
    timestamp: datetime
    response: ResponseCode
    echo_cmd: int  # Raw CMD byte, 0xFF for unknown version
    reason: ReasonCode

    def __post_init__(self) -> None:
        if self.timestamp.tzinfo is None:
            raise ValueError("timestamp must be timezone aware")

    @property
    def is_ack(self) -> bool:
        return self.response is ResponseCode.ACK

    @property
    def is_nack(self) -> bool:
        return self.response is ResponseCode.NACK


StreetlightEvent = Union[TelemetryReport, Heartbeat, CommandResponse]
