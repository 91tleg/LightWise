from datetime import datetime, timezone

from domain.telemetry.models import TelemetryPayload


# Payload versions
_PAYLOAD_V1 = 0x01
_PAYLOAD_V1_LEN = 7

# Flag bit masks (Payload v1)
FLAG_MOTION_PRESENT = 0x01  # Bit 0
FLAG_AMBIENT_PRIMARY_OK = 0x02  # Bit 1
FLAG_AMBIENT_SECONDARY_OK = 0x04  # Bit 2
FLAG_TH_OK = 0x08  # Bit 3
FLAG_MOTION_PRIMARY_OK = 0x10  # Bit 4
FLAG_MOTION_SECONDARY_OK = 0x20  # Bit 5
FLAG_SYSTEM_DEGRADED = 0x40  # Bit 6
FLAG_SYSTEM_OK = 0x80  # Bit 7


def decode_uplink(
    tenant_id: str,
    device_id: str,
    bytes_payload: bytes,
    timestamp: datetime = None
) -> TelemetryPayload:
    """
    Decode a versioned LoRaWAN payload into a Telemetry entity.
    """
    if len(bytes_payload) < 1:
        raise ValueError("Payload too short")

    version = bytes_payload[0]

    if version == _PAYLOAD_V1:
        return _decode_v1(tenant_id, device_id, bytes_payload, timestamp)

    raise ValueError(f"Unsupported payload version: {version}")


def _decode_v1(
    tenant_id: str,
    device_id: str,
    bytes_payload: bytes,
    timestamp: datetime = None
) -> TelemetryPayload:
    if len(bytes_payload) != _PAYLOAD_V1_LEN:
        raise ValueError("Payload must be exactly 7 bytes")

    flags = bytes_payload[5]

    system_ok = bool(flags & FLAG_SYSTEM_OK)
    system_degraded = bool(flags & FLAG_SYSTEM_DEGRADED)

    if system_ok and system_degraded:
        raise ValueError(
                "Invalid payload: SYSTEM_OK and SYSTEM_DEGRADED both set"
              )

    lux_x10 = (bytes_payload[1] << 8) | bytes_payload[2]

    if timestamp is None:
        timestamp = datetime.now(timezone.utc)

    return TelemetryPayload(
        tenant_id=tenant_id,
        device_id=device_id,
        lux=lux_x10 / 10.0,
        temperature_c=bytes_payload[3],
        humidity=bytes_payload[4],
        motion=bool(flags & FLAG_MOTION_PRESENT),
        ambient_primary_ok=bool(flags & FLAG_AMBIENT_PRIMARY_OK),
        ambient_secondary_ok=bool(flags & FLAG_AMBIENT_SECONDARY_OK),
        th_ok=bool(flags & FLAG_TH_OK),
        motion_primary_ok=bool(flags & FLAG_MOTION_PRIMARY_OK),
        motion_secondary_ok=bool(flags & FLAG_MOTION_SECONDARY_OK),
        system_degraded=system_degraded,
        overall_ok=system_ok,
        light_level=bytes_payload[6],
        timestamp=timestamp,
    )
