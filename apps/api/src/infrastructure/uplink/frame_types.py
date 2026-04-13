"""
Wire format constants for the LightWise LoRaWAN uplink payload.

Spec: Uplink Payload Specification v1
"""

PAYLOAD_VERSION = 0x01


class FrameType:
    HEARTBEAT = 0x00
    TELEMETRY = 0x01
    ACK_NACK = 0x02


class FrameLength:
    HEARTBEAT = 2
    TELEMETRY = 9
    ACK_NACK = 5


class TelemetryOffset:
    VERSION = 0
    TYPE = 1
    LUX_MSB = 2
    LUX_LSB = 3
    TEMP_C = 4
    HUMIDITY = 5
    FLAGS1 = 6
    FLAGS2 = 7
    LIGHT_LEVEL = 8


class Flags1:
    AMBIENT_HEALTH_MASK = 0x07   # Bits 0–2
    MMWAVE_HEALTH_MASK = 0x38    # Bits 3–5
    MMWAVE_HEALTH_SHIFT = 3
    MOTION_PRESENT = 0x40        # Bit 6
    OVERALL_OK = 0x80            # Bit 7


class Flags2:
    TH_OK = 0x01     # Bit 0
    LIGHT_OK = 0x02  # Bit 1


class AckNackOffset:
    VERSION = 0
    TYPE = 1
    RESPONSE_CODE = 2
    ECHO_CMD = 3
    REASON_CODE = 4


UNKNOWN_VERSION_ECHO_CMD = 0xFF
