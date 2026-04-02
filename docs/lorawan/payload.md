# LightWise LoRaWAN Payload Specification

**Version:** 1.3
**Last Updated:** March 28, 2026
**Byte Order:** Big-endian (MSB first)

---

## Changelog

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-03-19 | Max Chou | Initial specification |
| 1.1 | 2026-03-19 | Max Chou | Updated constraints to reflect API-side validation |
| 1.2 | 2026-03-22 | — | Fixed SET_MOTION_SENSITIVITY range mismatch; added API validation notes to OVERRIDE_ON and SET_TEMP_DIM; replaced RESUME_AUTO sentinel with 0xFF in unknown-version NACK example |
| 1.3 | 2026-04-01 | — | Removed SET_SCHEDULE (no RTC hardware); removed uplink-only tier (all devices run full tier); consolidated to single uplink version with type byte; updated flags to 3-bit health encoding across two flag bytes; added LightOk flag for AC bulb current sensing |

---

## Firmware Compatibility Matrix

| Firmware Version | Downlink Payload Version | Uplink Payload Version |
|---|---|---|
| v1.x.x | 0x01 | 0x01 |

---

## Adding a New Command (Non-Breaking)

New CMD bytes may be added within the same payload version provided:
- No existing CMD byte is reassigned
- No existing parameter layout is changed
- The new CMD byte is appended at the end of the CMD table

## Breaking Changes Require a New Payload Version

The following changes require incrementing the payload version byte:
- Reassigning an existing CMD byte
- Changing parameter order or size of an existing command
- Removing a command

---

## Downlink Frame Format

```
┌──────────┬──────────┬──────────────────────────┐
│ Byte 0   │ Byte 1   │ Byte 2 .. N              │
│ Version  │ CMD      │ Parameters               │
└──────────┴──────────┴──────────────────────────┘
```

- **Minimum frame length:** 2 bytes (version + CMD, for commands with no parameters)
- **Maximum frame length:** 6 bytes (within all LoRaWAN datarate limits)
- **Byte order:** Big-endian — most significant byte first for all multi-byte values
- **Payload version byte:** Always `0x01` for this specification

---

## NVS Persistence Summary

| Command | Persists to NVS |
|---|---|
| SET_LEVELS | Yes |
| SET_MOTION_TIMEOUT | Yes |
| OVERRIDE_ON | No — clears on reboot or RESUME_AUTO |
| OVERRIDE_OFF | No — clears on reboot or RESUME_AUTO |
| RESUME_AUTO | No — state transition only |
| REQUEST_UPLINK | No — one-time action |
| REBOOT | No — one-time action |
| SET_MOTION_SENSITIVITY | Yes |
| SET_HEARTBEAT_INTERVAL | Yes |
| SET_TEMP_DIM | No — temporary override, clears on reboot or expiry |

---

## Command Reference

### 0x01 — SET_LEVELS

Configure the max brightness and baseline dim level.

| Byte | Field | Type | Range | Description |
|---|---|---|---|---|
| 0 | version | uint8 | 0x01 | Payload version |
| 1 | cmd | uint8 | 0x01 | Command byte |
| 2 | max_level | uint8 | 1–100 | Max brightness % when motion triggered |
| 3 | dim_level | uint8 | 0–100 | Baseline dim % when idle, no motion |

**Constraints:**
- `dim_level` must be ≤ `max_level`
- `max_level` minimum is 1 — 0 is not permitted; use OVERRIDE_OFF to force light off
- Valid range: 1–100. The REST API performs pre-dispatch validation; values outside this range return 422 Unprocessable and are not transmitted. The device sends a NACK (InvalidParam) only if a malformed frame bypasses validation.
- Persists to NVS on successful receipt; NVS failure sends NACK and does not apply the command — in-memory config is not updated

**Example:** Set max to 90% (0x5A), dim to 30% (0x1E)
```
01 01 5A 1E
```

---

### 0x02 — SET_MOTION_TIMEOUT

Configure how long the light stays at max level after the last detected motion event.

| Byte | Field | Type | Range | Description |
|---|---|---|---|---|
| 0 | version | uint8 | 0x01 | Payload version |
| 1 | cmd | uint8 | 0x02 | Command byte |
| 2 | timeout_msb | uint8 | — | Timeout seconds, most significant byte |
| 3 | timeout_lsb | uint8 | — | Timeout seconds, least significant byte |

**Constraints:**
- Valid range: 15–3600 seconds (15 s minimum, 1 hour maximum). The REST API performs pre-dispatch validation; values outside this range return 422 Unprocessable and are not transmitted. The device sends a NACK (InvalidParam) only as a safety fallback if an invalid value bypasses the API.
- Persists to NVS on successful receipt; NVS failure sends NACK and does not apply the command — in-memory config is not updated

**Example:** Set motion timeout to 30 seconds (0x001E)
```
01 02 00 1E
```

---

### 0x03 — OVERRIDE_ON

Force the light ON at a specified level. Moves FSM to MANUAL state. Photocell logic is bypassed until RESUME_AUTO is received or the safety timeout expires.

| Byte | Field | Type | Range | Description |
|---|---|---|---|---|
| 0 | version | uint8 | 0x01 | Payload version |
| 1 | cmd | uint8 | 0x03 | Command byte |
| 2 | level | uint8 | 1–100 | Brightness level % |

**Constraints:**
- Level 0 is not permitted — use OVERRIDE_OFF (0x04) to force light off. The REST API performs pre-dispatch validation; a level of 0 returns 422 Unprocessable and is not transmitted. The device sends a NACK (InvalidParam) only if a malformed frame bypasses validation.
- FSM enters MANUAL state immediately on receipt
- Safety timeout: MANUAL state auto-expires after 8 hours if RESUME_AUTO not received
- Does not persist to NVS — a reboot during MANUAL state returns to AUTO

**Example:** Force ON at 100% (0x64)
```
01 03 64
```

---

### 0x04 — OVERRIDE_OFF

Force the light OFF. Moves FSM to MANUAL state. Photocell logic is bypassed until RESUME_AUTO is received or the safety timeout expires.

| Byte | Field | Type | Range | Description |
|---|---|---|---|---|
| 0 | version | uint8 | 0x01 | Payload version |
| 1 | cmd | uint8 | 0x04 | Command byte |

**Safety invariant:** OVERRIDE_OFF does not permanently disable the light. The FSM automatically returns to AUTO after the 8-hour safety timeout regardless. No command can leave a pole in a permanent OFF state.

**Example:**
```
01 04
```

---

### 0x05 — RESUME_AUTO

Clear any active manual override and return the FSM to AUTO mode. Photocell logic resumes immediately.

| Byte | Field | Type | Range | Description |
|---|---|---|---|---|
| 0 | version | uint8 | 0x01 | Payload version |
| 1 | cmd | uint8 | 0x05 | Command byte |

**Example:**
```
01 05
```

---

### 0x06 — REQUEST_UPLINK

Request an immediate status uplink from the device. Device responds with current sensor readings and status. Does not affect FSM state.

| Byte | Field | Type | Range | Description |
|---|---|---|---|---|
| 0 | version | uint8 | 0x01 | Payload version |
| 1 | cmd | uint8 | 0x06 | Command byte |

**Constraints:**
- Rate limiting is enforced by the Cloud API (1 request per 60 seconds)
- Device processes all received 0x06 commands immediately with a telemetry uplink

**Example:**
```
01 06
```

---

### 0x07 — REBOOT

Force a device restart. Device sends an ACK uplink before restarting.

| Byte | Field | Type | Range | Description |
|---|---|---|---|---|
| 0 | version | uint8 | 0x01 | Payload version |
| 1 | cmd | uint8 | 0x07 | Command byte |

**Behaviour:**
1. Device receives REBOOT command
2. Device sends ACK uplink (see ACK/NACK format below)
3. Device waits for uplink transmission to complete (SF7 ~100 ms, SF12 ~2500 ms)
4. Device calls `esp_restart()`

**Example:**
```
01 07
```

---

### 0x08 — SET_MOTION_SENSITIVITY

Remotely configure the mmWave motion sensor detection sensitivity.

| Byte | Field | Type | Range | Description |
|---|---|---|---|---|
| 0 | version | uint8 | 0x01 | Payload version |
| 1 | cmd | uint8 | 0x08 | Command byte |
| 2 | level | uint8 | 1–10 | Sensitivity level (1 = minimum, 10 = maximum) |

**Constraints:**
- Valid range: 1–10. The REST API performs pre-dispatch validation; values outside this range return 422 Unprocessable and are not transmitted. The device sends a NACK (InvalidParam) only if a malformed frame bypasses validation.
- Persists to NVS on successful receipt; NVS failure sends NACK and does not apply the command — in-memory config is not updated
- Applied on next reboot — mmWave sensor is reconfigured at startup

**Example:** Set sensitivity to 7 (0x07)
```
01 08 07
```

---

### 0x09 — SET_HEARTBEAT_INTERVAL

Configure how frequently the device sends a status uplink when idle and no events are occurring.

| Byte | Field | Type | Range | Description |
|---|---|---|---|---|
| 0 | version | uint8 | 0x01 | Payload version |
| 1 | cmd | uint8 | 0x09 | Command byte |
| 2 | interval_minutes | uint8 | 1–255 | Heartbeat interval in minutes |

**Constraints:**
- Valid range: 1–255. The REST API performs pre-dispatch validation; values outside this range return 422 Unprocessable and are not transmitted. The device sends a NACK (InvalidParam) only if a malformed frame bypasses validation.
- Persists to NVS on successful receipt; NVS failure sends NACK and does not apply the command — in-memory config is not updated
- LoRaWAN duty cycle limits take precedence — firmware will not violate duty cycle regardless of configured interval

**Example:** Set heartbeat to every 5 minutes (0x05)
```
01 09 05
```

---

### 0x0A — SET_TEMP_DIM

Apply a temporary dim level override that automatically expires after a specified duration.

| Byte | Field | Type | Range | Description |
|---|---|---|---|---|
| 0 | version | uint8 | 0x01 | Payload version |
| 1 | cmd | uint8 | 0x0A | Command byte |
| 2 | level | uint8 | 0–100 | Temporary dim level % |
| 3 | duration_hours | uint8 | 1–24 | Duration in hours before auto-expiry |

**Constraints:**
- Valid range: level 0–100, duration 1–24. The REST API performs pre-dispatch validation; values outside these ranges return 422 Unprocessable and are not transmitted. The device sends a NACK (InvalidParam) only if a malformed frame bypasses validation.
- Does not enter MANUAL state — FSM remains in AUTO, only dim level is overridden
- Level 0 is permitted — temporarily extinguishes light while keeping FSM in AUTO
- Motion events still trigger max level during the temp dim window
- On expiry, dim level returns to the value configured by SET_LEVELS
- Does not persist to NVS — a reboot during the window returns to the SET_LEVELS dim value

**Example:** Dim to 20% (0x14) for 3 hours (0x03)
```
01 0A 14 03
```

---

## CMD Quick Reference

| CMD | Command | Parameters | Frame Bytes |
|---|---|---|---|
| 0x01 | SET_LEVELS | max_level, dim_level | 4 |
| 0x02 | SET_MOTION_TIMEOUT | timeout (2 bytes, big-endian) | 4 |
| 0x03 | OVERRIDE_ON | level | 3 |
| 0x04 | OVERRIDE_OFF | — | 2 |
| 0x05 | RESUME_AUTO | — | 2 |
| 0x06 | REQUEST_UPLINK | — | 2 |
| 0x07 | REBOOT | — | 2 |
| 0x08 | SET_MOTION_SENSITIVITY | level (1–10) | 3 |
| 0x09 | SET_HEARTBEAT_INTERVAL | interval_minutes uint8 | 3 |
| 0x0A | SET_TEMP_DIM | level, duration_hours | 4 |
| 0x0B–0xFF | Reserved | — | — |

---

## Error Handling

| Condition | Firmware Behaviour |
|---|---|
| Payload version mismatch | Discard packet, send NACK (reason: InvalidVersion) |
| Unknown CMD byte | Discard packet, send NACK (reason: InvalidCmd) |
| Invalid parameter range | Discard packet, send NACK (reason: InvalidParam) |
| Payload too short | Discard packet, send NACK (reason: PayloadTooShort) |
| NVS write failure | Discard command (not applied), send NACK (reason: NvsError) — in-memory config is not updated |

---

## Safety Invariants

These rules are enforced in firmware regardless of any downlink command received:

1. **Fail-Safe AUTO** — If the LoRaWAN stack fails or no downlink is received for 24 hours, the FSM defaults to AUTO mode. No downlink command can permanently disable a light.
2. **MANUAL state timeout** — OVERRIDE_ON and OVERRIDE_OFF automatically expire after 8 hours. The FSM returns to AUTO without requiring RESUME_AUTO.
3. **OVERRIDE_OFF is not permanent** — A light forced OFF via downlink returns to AUTO after the safety timeout. There is no command that permanently disables a pole.
4. **Duty cycle compliance** — Firmware never violates LoRaWAN regional duty cycle limits regardless of heartbeat interval or REQUEST_UPLINK frequency.
5. **NVS persistence** — All SET commands persist to NVS so configured values survive a power outage or reboot. MANUAL state and temporary overrides are explicitly excluded.
6. **REBOOT confirmation** — Device must complete ACK uplink transmission before executing a reboot. Transmission wait accounts for the configured spreading factor.

---

# LightWise Uplink Payload Specification

**Version:** 1.1
**Last Updated:** March 28, 2026
**Byte Order:** Big-endian (MSB first)

---

## Overview

The backend Lambda identifies the frame type from `payload[1]` (type byte) and routes accordingly.

| Type Byte | Frame Type | Total Bytes |
|---|---|---|
| `0x00` | HeartBeat | 2 |
| `0x01` | Telemetry | 9 |
| `0x02` | ACK/NACK | 5 |

---

## Uplink Frame Format

```
┌──────────┬──────────┬──────────────────────────┐
│ Byte 0   │ Byte 1   │ Byte 2 .. N              │
│ Version  │ Type     │ Payload                  │
└──────────┴──────────┴──────────────────────────┘
```

- **Version byte:** Always `0x01`
- **Type byte:** `0x00` = heartbeat, `0x01` = telemetry, `0x02` = ACK/NACK

---

## Type 0x00 - Heartbeat (2 bytes)
| Byte | Field | Type | Description |
|---|---|---|---|
| 0 | version | uint8 | `0x01` |
| 1 | type | uint8 | `0x00` (Heartbeat) |

## Type 0x01 — Telemetry (9 bytes)

| Byte | Field | Type | Description |
|---|---|---|---|
| 0 | version | uint8 | Always `0x01` |
| 1 | type | uint8 | Always `0x01` (telemetry) |
| 2–3 | lux_x10 | uint16 BE | Ambient light × 10 (e.g. 1234 = 123.4 lux) |
| 4 | tempC | int8 | Temperature in °C (signed) |
| 5 | humidity | uint8 | Relative humidity 0–100% |
| 6 | flags1 | uint8 | Sensor health + motion (see Flags) |
| 7 | flags2 | uint8 | TH health + light ok (see Flags) |
| 8 | lightLevel | uint8 | Current light output 0–100% |

---

## Type 0x02 — ACK/NACK (5 bytes)

Sent by the device immediately after processing a downlink command. Stored in DynamoDB command audit table only — not forwarded to InfluxDB.

| Byte | Field | Type | Description |
|---|---|---|---|
| 0 | version | uint8 | Always `0x01` |
| 1 | type | uint8 | Always `0x02` (ACK/NACK) |
| 2 | responseCode | uint8 | `0x00` = ACK, `0x01` = NACK |
| 3 | echoCmd | uint8 | CMD byte from the downlink being acknowledged |
| 4 | reasonCode | uint8 | See Reason Codes below |

### Response Codes

| Value | Meaning |
|---|---|
| `0x00` | ACK — command accepted and applied |
| `0x01` | NACK — command rejected |

### Reason Codes

| Value | Name | Meaning |
|---|---|---|
| `0x00` | Ok | Command accepted successfully |
| `0x01` | InvalidVersion | Downlink version byte not recognised |
| `0x02` | InvalidCmd | CMD byte not recognised |
| `0x03` | InvalidParam | Parameter out of valid range or constraint violated |
| `0x04` | NvsError | NVS write failed — command not applied |
| `0x05` | FsmError | FSM rejected the state transition |
| `0x06` | PayloadTooShort | Frame shorter than minimum for this command |

**Example — ACK for SET_LEVELS:**
```
01 02 00 01 00
```

**Example — NACK for SET_LEVELS (invalid parameter):**
```
01 02 01 01 03
```

**Example — NACK for unknown version (sentinel 0xFF, no valid CMD to echo):**
```
01 02 01 FF 01
```

---

## Status Flags

### flags1 (Byte 6)

| Bits | Mask | Name | Meaning |
|---|---|---|---|
| 0–2 | `0x07` | AmbientHealth | 3-bit ambient sensor health (see Health Encoding) |
| 3–5 | `0x38` | MmwaveHealth | 3-bit mmWave sensor health (see Health Encoding) |
| 6 | `0x40` | MotionPresent | Motion currently detected |
| 7 | `0x80` | OverallOk | All sensors healthy and bulb drawing expected current |

### flags2 (Byte 7)

| Bit | Mask | Name | Meaning |
|---|---|---|---|
| 0 | `0x01` | ThOk | TH sensor healthy |
| 1 | `0x02` | LightOk | AC bulb drawing expected current when commanded on |
| 2–7 | `0xFC` | Reserved | — |

### Health Encoding (3-bit)

| Value | Meaning |
|---|---|
| `0b000` | TOTAL_FAILURE — no valid readings |
| `0b001` | PRIMARY_FAIL — primary sensor unresponsive |
| `0b010` | SECONDARY_FAIL — secondary sensor unresponsive |
| `0b011` | DEGRADED — both responding but consistently disagreeing |
| `0b100` | SYSTEM_OK — both sensors healthy and agreeing |

**Example — all healthy, no motion:**
```
flags1 = 0b10100100 = 0xA4  (ambient=SYSTEM_OK, mmwave=SYSTEM_OK, motion=0, overallOk=1)
flags2 = 0b00000011 = 0x03  (thOk=1, lightOk=1)
```

**Example — ambient sensor degraded:**
```
flags1 = 0b00100011 = 0x23  (ambient=DEGRADED, mmwave=SYSTEM_OK, motion=0, overallOk=0)
flags2 = 0b00000011 = 0x03  (thOk=1, lightOk=1)
```

---

## Database Routing Summary

| Frame | InfluxDB | DynamoDB |
|---|---|---|
| Telemetry | ✓ (time series) | ✓ (device state) |
| ACK/NACK | ✗ | ✓ (command audit trail) |