"""
LightWise LoRaWAN uplink decoder.

Infrastructure layer - translates raw bytes into domain event objects.
Spec: Uplink Payload Specification v1
"""

from __future__ import annotations
import struct
from enum import EnumMeta
from typing import TypeVar

from infrastructure.uplink.models import IoTUplink
from domain.streetlight.events import (
    CommandResponse,
    Heartbeat,
    ReasonCode,
    ResponseCode,
    SensorReadings,
    TelemetryReport,
)
from domain.streetlight.health import SensorDiagnostics, SensorHealth
from domain.streetlight.events import StreetlightEvent
from infrastructure.uplink.errors import DecodeError
from infrastructure.uplink.frame_types import (
    AckNackOffset,
    Flags1,
    Flags2,
    FrameLength,
    FrameType,
    PAYLOAD_VERSION,
    TelemetryOffset,
)

_E = TypeVar("_E")


def decode_uplink(uplink: IoTUplink) -> StreetlightEvent:
    _require_length(uplink.payload_bytes, minimum=2, context="uplink")
    _require_version(uplink.payload_bytes[0])

    frame_type = uplink.payload_bytes[1]

    if frame_type == FrameType.HEARTBEAT:
        return _decode_heartbeat(uplink)

    if frame_type == FrameType.TELEMETRY:
        return _decode_telemetry(uplink)

    if frame_type == FrameType.ACK_NACK:
        return _decode_command_response(uplink)

    raise DecodeError(f"Unknown frame type: 0x{frame_type:02X}")


def _decode_heartbeat(uplink: IoTUplink) -> Heartbeat:
    _require_length(
        uplink.payload_bytes, FrameLength.HEARTBEAT, context="HEARTBEAT"
    )

    return Heartbeat(
        tenant_id=uplink.tenant_id,
        streetlight_id=uplink.streetlight_id,
        site_id=uplink.site_id,
        timestamp=uplink.received_at,
    )


def _decode_telemetry(uplink: IoTUplink) -> TelemetryReport:
    raw = uplink.payload_bytes
    _require_length(raw, FrameLength.TELEMETRY, context="TELEMETRY")

    lux_x10, = struct.unpack_from(">H", raw, TelemetryOffset.LUX_MSB)
    temp_c, = struct.unpack_from(">b", raw, TelemetryOffset.TEMP_C)
    flags1 = raw[TelemetryOffset.FLAGS1]
    flags2 = raw[TelemetryOffset.FLAGS2]

    readings = SensorReadings(
        lux=lux_x10 / 10.0,
        temperature_c=temp_c,
        humidity=raw[TelemetryOffset.HUMIDITY],
        light_level=raw[TelemetryOffset.LIGHT_LEVEL],
        motion=bool(flags1 & Flags1.MOTION_PRESENT),
    )

    diagnostics = SensorDiagnostics(
        ambient_health=_decode_sensor_health(
            flags1 & Flags1.AMBIENT_HEALTH_MASK, "ambient"
        ),
        mmwave_health=_decode_sensor_health(
            (flags1 & Flags1.MMWAVE_HEALTH_MASK)
            >> Flags1.MMWAVE_HEALTH_SHIFT,
            "mmwave"
        ),
        th_ok=bool(flags2 & Flags2.TH_OK),
        light_ok=bool(flags2 & Flags2.LIGHT_OK),
        overall_ok=bool(flags1 & Flags1.OVERALL_OK),
    )

    return TelemetryReport(
        tenant_id=uplink.tenant_id,
        streetlight_id=uplink.streetlight_id,
        site_id=uplink.site_id,
        timestamp=uplink.received_at,
        readings=readings,
        diagnostics=diagnostics,
        # Now passing radio metadata into the domain event
        rssi=uplink.rssi,
        snr=uplink.snr,
    )


def _decode_command_response(uplink: IoTUplink) -> CommandResponse:
    raw = uplink.payload_bytes
    _require_length(raw, FrameLength.ACK_NACK, context="ACK_NACK")

    response = _decode_enum(
        ResponseCode, raw[AckNackOffset.RESPONSE_CODE], "response code"
    )
    reason = _decode_enum(
        ReasonCode, raw[AckNackOffset.REASON_CODE], "reason code"
    )

    return CommandResponse(
        tenant_id=uplink.tenant_id,
        streetlight_id=uplink.streetlight_id,
        timestamp=uplink.received_at,
        response=response,
        echo_cmd=raw[AckNackOffset.ECHO_CMD],
        reason=reason,
    )


def _require_length(raw: bytes, minimum: int, context: str) -> None:
    if len(raw) < minimum:
        raise DecodeError(
            f"{context}: payload too short - "
            f"expected >= {minimum} bytes, got {len(raw)}"
        )


def _require_version(version: int) -> None:
    if version != PAYLOAD_VERSION:
        raise DecodeError(
            f"Unsupported payload version: 0x{version:02X} "
            f"(expected 0x{PAYLOAD_VERSION:02X})"
        )


def _decode_sensor_health(raw_value: int, context: str) -> SensorHealth:
    try:
        return SensorHealth(raw_value)
    except ValueError as exc:
        raise DecodeError(
            f"Invalid {context} health value: 0b{raw_value:03b}"
        ) from exc


def _decode_enum(enum_type: EnumMeta, raw_value: int, context: str) -> _E:
    try:
        return enum_type(raw_value)
    except ValueError as exc:
        raise DecodeError(
            f"Unknown {context}: 0x{raw_value:02X}"
        ) from exc
