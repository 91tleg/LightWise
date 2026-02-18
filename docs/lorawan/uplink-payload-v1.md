# LoRaWAN Payload Specification V1

**Uplink Payload length:** 7 bytes  
**Endianness:** Big-endian for multi-byte fields
**Versioned:** Yes (byte 0)

---

## 1. Uplink Payload Structure

| Byte | Field           | Type       | Units    | Description                                 |
|------|-----------------|------------|----------|---------------------------------------------|
| 0    | `payloadVersion`| `uint8_t`  | -        | Versioned payload ( currently `0x01`)       |
| 1–2  | `lux_x10`       | `uint16_t` | lux × 10 | Ambient light intensity (scaled ×10)        |
| 3    | `tempC`         | `uint8_t`  | °C       | Temperature in Celsius                      |
| 4    | `humidity`      | `uint8_t`  | %        | Relative humidity (0–100)                   |
| 5    | `flags`         | `uint8_t`  | –        | Status and motion flags                     |
| 6    | `lightLevel`    | `uint8_t`  | %        | User-configured light level (0–100)         |

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
| 6   | `FLAG_OVERALL_DEGRADED`     | System degraded                          |
| 7   | `FLAG_OVERALL_OK`           | Derived overall health (all critical sensors OK) |

**Note:**
`FLAG_OVERALL_OK` is derived onboard and duplicated for backend simplicity.
It MUST NOT be used as the sole health indicator.

---

## 3. Example Payload

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
OVERALL_DEGRADED = 0
OVERALL_OK = 1 (derived)  

Binary: 10111011  

Hex: **0xBB**  


### Step 3 – Complete payload (big-endian)

| Byte | Value | Description       |
|------|-------|-------------------|
| 0    | 0x01  | payload version   |
| 1    | 0x04  | lux_x10 MSB       |
| 2    | 0xD2  | lux_x10 LSB       |
| 3    | 0x19  | tempC = 25        |
| 4    | 0x3C  | humidity = 60     |
| 5    | 0xBB  | flags             |
| 6    | 0x50  | lightLevel = 80   |

**Payload in hex:**    
01 04 D2 19 3C BB 50


---

## 4. Decoding Rules (Backend Example)

```python
def decode_uplink(bytes_payload: bytes) -> dict:
    """
    Decode a 7-byte versioned LoRaWAN payload.

    Payload layout (v1):
    Byte 0  : version
    Byte 1-2: lux_x10 (uint16, big-endian)
    Byte 3  : tempC (uint8)
    Byte 4  : humidity (uint8)
    Byte 5  : flags (uint8)
    Byte 6  : lightLevel (uint8)
    """
    if len(bytes_payload) != 7:
        raise ValueError("Payload must be exactly 7 bytes")

    version = bytes_payload[0]
    if version != 0x01:
        raise ValueError(f"Unsupported payload version: {version}")

    lux_x10 = (bytes_payload[1] << 8) | bytes_payload[2]
    flags = bytes_payload[5]

    return {
        "version": version,
        "lux": lux_x10 / 10.0,
        "tempC": bytes_payload[3],
        "humidity": bytes_payload[4],
        "motion": bool(flags & 0x01),
        "alspt19PrimaryOk": bool(flags & 0x02),
        "alspt19SecondaryOk": bool(flags & 0x04),
        "dhtOk": bool(flags & 0x08),
        "c4001PrimaryOk": bool(flags & 0x10),
        "c4001SecondaryOk": bool(flags & 0x20),
        "overallOk": bool(flags & 0x80),
        "lightLevel": bytes_payload[6],
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

## 5. ESP32-S3 Implementation Notes

Endian Handling: ESP32 is little-endian; convert lux_x10 to big-endian for LoRaWAN uplink.

Fixed-point Arithmetic: Avoid sending floats.

Flags: Compute OVERALL_OK from critical sensors.

Versioning: Use reserved bits for future expansion.

Payload Efficiency: 7 bytes is compact for Class A/C LoRaWAN devices.

---

**Document Version**: 1.1   
**Last Updated**: February 17, 2026  