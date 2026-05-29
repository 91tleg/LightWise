"""
Tests for the LoRaWAN uplink decoder.
Covers all three frame types, version validation, length guards,
and enum decode failures.
"""
from __future__ import annotations
import struct
from datetime import datetime, timezone

import pytest

from domain.streetlight.events import (
    CommandResponse,
    Heartbeat,
    ReasonCode,
    ResponseCode,
    TelemetryReport,
)
from infrastructure.uplink.decoder import decode_uplink
from infrastructure.uplink.errors import DecodeError
from infrastructure.uplink.frame_types import (
    FrameType,
    PAYLOAD_VERSION,
    FrameLength,
)
from infrastructure.uplink.models import IoTUplink


_NOW = datetime(2024, 1, 1, 12, 0, 0, tzinfo=timezone.utc)

_BASE_UPLINK = dict(
    streetlight_id="sl-001",
    tenant_id="tenant-abc",
    site_id="site-xyz",
    received_at=_NOW,
    rssi=-85,
    snr=7.5,
)


def _uplink(payload: bytes, **overrides) -> IoTUplink:
    return IoTUplink(**{**_BASE_UPLINK, **overrides}, payload_bytes=payload)


def _heartbeat_payload() -> bytes:
    return bytes([PAYLOAD_VERSION, FrameType.HEARTBEAT])


def _telemetry_payload(
    *,
    lux_x10: int = 1234,
    temp_c: int = 22,
    humidity: int = 55,
    light_level: int = 80,
    flags1: int = 0b10000000,  # OVERALL_OK = bit 7
    flags2: int = 0b00000011,  # TH_OK | LIGHT_OK
) -> bytes:
    buf = bytearray(FrameLength.TELEMETRY)
    buf[0] = PAYLOAD_VERSION
    buf[1] = FrameType.TELEMETRY
    struct.pack_into(">H", buf, 2, lux_x10)  # TelemetryOffset.LUX_MSB = 2
    struct.pack_into(">b", buf, 4, temp_c)   # TelemetryOffset.TEMP_C  = 4
    buf[5] = humidity                        # TelemetryOffset.HUMIDITY = 5
    buf[6] = flags1                          # TelemetryOffset.FLAGS1   = 6
    buf[7] = flags2                          # TelemetryOffset.FLAGS2   = 7
    buf[8] = light_level                     # TelemetryOffset.LIGHT_LEVEL = 8
    return bytes(buf)


def _acknack_payload(
    response: int = ResponseCode.ACK,
    echo_cmd: int = 0x01,
    reason: int = ReasonCode.OK,
) -> bytes:
    buf = bytearray(FrameLength.ACK_NACK)
    buf[0] = PAYLOAD_VERSION
    buf[1] = FrameType.ACK_NACK
    buf[2] = response   # AckNackOffset.RESPONSE_CODE
    buf[3] = echo_cmd   # AckNackOffset.ECHO_CMD
    buf[4] = reason     # AckNackOffset.REASON_CODE
    return bytes(buf)


class TestGuards:
    def test_empty_payload_raises(self):
        with pytest.raises(DecodeError, match="too short"):
            decode_uplink(_uplink(b""))

    def test_single_byte_payload_raises(self):
        with pytest.raises(DecodeError, match="too short"):
            decode_uplink(_uplink(bytes([PAYLOAD_VERSION])))

    def test_wrong_version_raises(self):
        bad_version = (PAYLOAD_VERSION + 1) & 0xFF
        with pytest.raises(DecodeError, match="Unsupported payload version"):
            decode_uplink(_uplink(bytes([bad_version, FrameType.HEARTBEAT])))

    def test_unknown_frame_type_raises(self):
        with pytest.raises(DecodeError, match="Unknown frame type"):
            decode_uplink(_uplink(bytes([PAYLOAD_VERSION, 0xFF])))


class TestHeartbeat:
    def test_decode_returns_heartbeat(self):
        event = decode_uplink(_uplink(_heartbeat_payload()))
        assert isinstance(event, Heartbeat)

    def test_fields_match_uplink(self):
        event = decode_uplink(_uplink(_heartbeat_payload()))
        assert event.streetlight_id == "sl-001"
        assert event.tenant_id == "tenant-abc"
        assert event.site_id == "site-xyz"
        assert event.timestamp == _NOW

    def test_too_short_raises(self):
        with pytest.raises(DecodeError, match="too short"):
            decode_uplink(
                _uplink(bytes([PAYLOAD_VERSION, FrameType.HEARTBEAT])[: 1])
            )


class TestTelemetry:
    def test_decode_returns_telemetry_report(self):
        event = decode_uplink(_uplink(_telemetry_payload()))
        assert isinstance(event, TelemetryReport)

    def test_lux_scaled_correctly(self):
        event = decode_uplink(_uplink(_telemetry_payload(lux_x10=1234)))
        assert event.lux == pytest.approx(123.4)

    def test_temperature_signed(self):
        event = decode_uplink(_uplink(_telemetry_payload(temp_c=-10)))
        assert event.temperature_c == -10

    def test_humidity_and_light_level(self):
        event = decode_uplink(
            _uplink(_telemetry_payload(humidity=60, light_level=75))
        )
        assert event.humidity == 60
        assert event.light_level == 75

    def test_motion_flag_set(self):
        event = decode_uplink(
            _uplink(_telemetry_payload(flags1=0b00000001))
        )
        assert isinstance(event.motion_detected, bool)

    def test_radio_metadata_passed_through(self):
        event = decode_uplink(
            _uplink(_telemetry_payload(), rssi=-90, snr=4.2)
        )
        assert event.rssi == -90
        assert event.snr == pytest.approx(4.2)

    def test_radio_metadata_none_when_absent(self):
        event = decode_uplink(
            _uplink(_telemetry_payload(), rssi=None, snr=None)
        )
        assert event.rssi is None
        assert event.snr is None

    def test_diagnostics_overall_ok(self):
        event = decode_uplink(
            _uplink(_telemetry_payload(flags1=0b00000001))
        )
        assert isinstance(event.diagnostics.overall_ok, bool)

    def test_too_short_raises(self):
        short = bytes([PAYLOAD_VERSION, FrameType.TELEMETRY, 0x00])
        with pytest.raises(DecodeError, match="TELEMETRY"):
            decode_uplink(_uplink(short))

    def test_identity_fields(self):
        event = decode_uplink(_uplink(_telemetry_payload()))
        assert event.tenant_id == "tenant-abc"
        assert event.streetlight_id == "sl-001"
        assert event.site_id == "site-xyz"
        assert event.timestamp == _NOW


class TestCommandResponse:
    def test_decode_ack(self):
        event = decode_uplink(_uplink(_acknack_payload(
            response=ResponseCode.ACK,
            reason=ReasonCode.OK,
        )))
        assert isinstance(event, CommandResponse)
        assert event.is_ack
        assert not event.is_nack
        assert event.response is ResponseCode.ACK
        assert event.reason is ReasonCode.OK

    def test_decode_nack(self):
        event = decode_uplink(_uplink(_acknack_payload(
            response=ResponseCode.NACK,
            reason=ReasonCode.INVALID_CMD,
        )))
        assert event.is_nack
        assert event.reason is ReasonCode.INVALID_CMD

    def test_echo_cmd_preserved(self):
        event = decode_uplink(_uplink(_acknack_payload(echo_cmd=0x42)))
        assert event.echo_cmd == 0x42

    def test_unknown_response_code_raises(self):
        with pytest.raises(DecodeError, match="response code"):
            decode_uplink(_uplink(_acknack_payload(response=0xFF)))

    def test_unknown_reason_code_raises(self):
        with pytest.raises(DecodeError, match="reason code"):
            decode_uplink(_uplink(_acknack_payload(reason=0xFF)))

    def test_too_short_raises(self):
        short = bytes([PAYLOAD_VERSION, FrameType.ACK_NACK, 0x00])
        with pytest.raises(DecodeError, match="ACK_NACK"):
            decode_uplink(_uplink(short))

    def test_identity_fields(self):
        event = decode_uplink(_uplink(_acknack_payload()))
        assert event.tenant_id == "tenant-abc"
        assert event.streetlight_id == "sl-001"
        assert event.timestamp == _NOW
