# LoRaWAN Payload Specification V1.0

**Uplink Payload length:** 6 bytes  
**Encoding:** Binary, big-endian  

---

## 1. Uplink Payload Structure

| Byte | Field        | Type     | Units | Description                              |
|------|-------------|---------|-------|------------------------------------------|
| 0–1  | `lux_x10`   | `uint16_t` | lux × 10 | Ambient light intensity (scaled ×10) |
| 2    | `tempC`     | `uint8_t`  | °C      | Temperature in Celsius                |
| 3    | `humidity`  | `uint8_t`  | %       | Relative humidity (0–100)             |
| 4    | `flags`     | `uint8_t`  | –       | Status and motion flags               |
| 5    | `lightLevel`| `uint8_t`  | %       | User-configured light level (0–100)  |

**Total:** 6 bytes

---

## 2. Flags Byte Definition

| Bit | Name                        | Meaning                                  |
|-----|-----------------------------|------------------------------------------|
| 0   | `FLAG_MOTION_PRESENT`       | Motion detected (1 = yes)                |
| 1   | `FLAG_ALSPT19_PRIMARY_OK`   | Primary ALS/PT19 sensor OK               |
| 2   | `FLAG_ALSPT19_SECONDARY_OK` | Secondary ALS/PT19 sensor OK             |
| 3   | `FLAG_DHT_OK`               | Temperature/Humidity sensor OK           |
| 4   | `FLAG_C4001_PRIMARY_OK`     | Primary C4001 sensor OK                  |
| 5   | `FLAG_C4001_SECONDARY_OK`   | Secondary C4001 sensor OK                |
| 6   | Reserved                    | For future use                           |
| 7   | `FLAG_OVERALL_OK`           | Derived overall health (all critical sensors OK) |

> **Note:** Bit 6 is reserved. Always include individual sensor flags for precise diagnostics.

---

## 3. Encoding Notes

- **Big-endian** for multi-byte values (`lux_x10`).  
- Fixed-point scaling avoids sending floats:  


- Flags packed into a single byte.  
- `lightLevel` is a uint8_t from 0–100.

---

## 4. Example Payload

### Sensor Reading

| Field                    | Value |
|--------------------------|-------|
| lux                      | 123.4 |
| tempC                    | 25    |
| humidity                 | 60    |
| motion                   | true  |
| ALS primary              | OK    |
| ALS secondary            | FAIL  |
| DHT                      | OK    |
| C4001 primary            | OK    |
| C4001 secondary          | OK    |
| lightLevel               | 80    |

### Step 1 – Compute scaled values

lux_x10 = 123.4 × 10 = 1234 = **0x04D2**

### Step 2 – Compute flags byte

motion = 1  
ALS primary = 1  
ALS secondary = 0  
DHT = 1  
C4001 primary = 1  
C4001 secondary = 1  
OVERALL_OK = 1 (derived)  
Binary: 10111011  
Hex: **0xBB**  


### Step 3 – Complete payload (big-endian)

| Byte | Value | Description       |
|------|-------|-------------------|
| 0    | 0x04  | lux_x10 MSB       |
| 1    | 0xD2  | lux_x10 LSB       |
| 2    | 0x19  | tempC = 25        |
| 3    | 0x3C  | humidity = 60     |
| 4    | 0xBB  | flags             |
| 5    | 0x50  | lightLevel = 80   |

**Payload in hex:**    
04 D2 19 3C BB 50


---

## 5. Decoding Rules (Backend Example)

```python
def decode_uplink(bytes_payload: bytes) -> dict:
    """
    Decode a 6-byte LoRaWAN payload into sensor readings and flags.

    Payload layout:
    Byte 0-1: lux_x10 (uint16, big-endian)
    Byte 2: tempC (uint8)
    Byte 3: humidity (uint8)
    Byte 4: flags (uint8)
    Byte 5: lightLevel (uint8)
    """
    if len(bytes_payload) != 6:
        raise ValueError("Payload must be exactly 6 bytes")

    lux_x10 = (bytes_payload[0] << 8) | bytes_payload[1]
    flags = bytes_payload[4]

    return {
        "lux": lux_x10 / 10.0,
        "tempC": bytes_payload[2],
        "humidity": bytes_payload[3],
        "motion": bool(flags & 0x01),
        "alspt19PrimaryOk": bool(flags & 0x02),
        "alspt19SecondaryOk": bool(flags & 0x04),
        "dhtOk": bool(flags & 0x08),
        "c4001PrimaryOk": bool(flags & 0x10),
        "c4001SecondaryOk": bool(flags & 0x20),
        "overallOk": bool(flags & 0x80),
        "lightLevel": bytes_payload[5]
    }
```

Output for the example payload `04 D2 19 3C BB 50`:
```python
{
  'lux': 123.4,
  'tempC': 25,
  'humidity': 60,
  'motion': True,
  'alspt19PrimaryOk': True,
  'alspt19SecondaryOk': False,
  'dhtOk': True,
  'c4001PrimaryOk': True,
  'c4001SecondaryOk': True,
  'overallOk': True,
  'lightLevel': 80
}
```

## 6. ESP32-S3 Implementation Notes

Endian Handling: ESP32 is little-endian; convert lux_x10 to big-endian for LoRaWAN uplink.

Fixed-point Arithmetic: Avoid sending floats.

Flags: Compute OVERALL_OK from critical sensors.

Versioning: Use reserved bits for future expansion.

Payload Efficiency: 6 bytes is compact for Class A/C LoRaWAN devices.

---

**Document Version**: 1.0   
**Last Updated**: February 8, 2026  