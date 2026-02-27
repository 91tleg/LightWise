from datetime import datetime, timezone, timedelta

from infrastructure.telemetry.lorawan_decoder import decode_uplink


def test_decode_v1_all_fields():
    # GIVEN: A version 1 payload
    # [0] Version: 1
    # [1-2] Lux: 0x1388 (5000) -> 5000 / 10 = 500.0
    # [3] Temp: 25°C
    # [4] Humidity: 50%
    # [5] Flags: 0x80 (Binary 10000000 -> FLAG_SYSTEM_OK)
    # [6] LightLevel: 255
    raw = bytes([0x01, 0x13, 0x88, 0x19, 0x32, 0x80, 0xFF])
    tenant_id = "tenant-1"
    streetlight_id = "dev-1"

    # WHEN: Decoding the uplink
    result = decode_uplink(tenant_id, streetlight_id, raw)

    # THEN: All identity and metadata fields must match
    assert result.tenant_id == tenant_id
    assert result.streetlight_id == streetlight_id

    # THEN: All sensor values must be correctly transformed
    assert result.lux == 500.0
    assert result.temperature_c == 25
    assert result.humidity == 50
    assert result.light_level == 255

    # THEN: All boolean flags from bitmask 0x80 (10000000)
    assert result.overall_ok is True
    assert result.system_degraded is False
    assert result.motion is False
    assert result.ambient_primary_ok is False
    assert result.ambient_secondary_ok is False
    assert result.th_ok is False
    assert result.motion_primary_ok is False
    assert result.motion_secondary_ok is False

    # THEN: Timestamp should be recent (within 1 second)
    now = datetime.now(timezone.utc)
    assert now - timedelta(seconds=1) <= result.timestamp <= now
