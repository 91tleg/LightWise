# LightWise LoRaWAN Payload Specification

**Version:** 1.0  
**Last Updated:** March 19, 2026  
**Byte Order:** Big-endian (MSB first)

---

## Changelog

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-03-19 | Max Chou | Initial specification |
| 1.1 | 2026-03-19 | Max Chou | Updated constraints to reflect API-side validation |

---

## Firmware Compatibility Matrix

| Firmware Version | Downlink Payload Version | Uplink Payload Version |
|---|---|---|
| v1.x.x | 0x01 | 0x01 (uplink-only tier) or 0x02 (full tier) |

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
| SET_SCHEDULE | Yes |
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
| 2 | max_level | uint8 | 1–100 | Max brightness % when motion triggered or scheduled ON |
| 3 | dim_level | uint8 | 0–100 | Baseline dim % when idle, no motion |

**Constraints:**
- `dim_level` must be ≤ `max_level`
- `max_level` minimum is 1 — 0 is not permitted; use OVERRIDE_OFF to force light off
- Valid range: 1-100. The REST API performs pre-dispatch validation; values outside this range return 422 Unprocessable and are not transmitted. The device sends a NACK (InvalidParam) only if a malformed frame bypasses validation.
- Persists to NVS on successful receipt; NVS failure sends NACK and discards the command

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
- Valid range: 15–3600 seconds (15 s minimum, 1 hour maximum)
- Valid range: 15–3600 seconds. The REST API performs pre-dispatch validation (422 Unprocessable) for out-of-range values. The device sends a NACK (InvalidParam) only as a safety fallback if an invalid value bypasses the API.
- Persists to NVS on successful receipt; NVS failure sends NACK and discards the command

**Example:** Set motion timeout to 30 seconds (0x001E)
```
01 02 00 1E
```

---

### 0x03 — OVERRIDE_ON

Force the light ON at a specified level. Moves FSM to MANUAL state. Local photocell and timer logic are bypassed until RESUME_AUTO is received or the safety timeout expires.

| Byte | Field | Type | Range | Description |
|---|---|---|---|---|
| 0 | version | uint8 | 0x01 | Payload version |
| 1 | cmd | uint8 | 0x03 | Command byte |
| 2 | level | uint8 | 1–100 | Brightness level % |

**Constraints:**
- Level 0 is not permitted — use OVERRIDE_OFF (0x04) to force light off
- FSM enters MANUAL state immediately on receipt
- Safety timeout: MANUAL state auto-expires after 8 hours if RESUME_AUTO not received
- Does not persist to NVS — a reboot during MANUAL state returns to AUTO

**Example:** Force ON at 100% (0x64)
```
01 03 64
```

---

### 0x04 — OVERRIDE_OFF

Force the light OFF. Moves FSM to MANUAL state. Local photocell and timer logic are bypassed until RESUME_AUTO is received or the safety timeout expires.

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

Clear any active manual override and return the FSM to AUTO mode. Photocell and timer logic resume immediately.

| Byte | Field | Type | Range | Description |
|---|---|---|---|---|
| 0 | version | uint8 | 0x01 | Payload version |
| 1 | cmd | uint8 | 0x05 | Command byte |

**Example:**
```
01 05
```

---

### 0x06 — SET_SCHEDULE

Configure the daily ON and OFF schedule times in whole hours. The photocell remains active as a fallback — if ambient light is above threshold before the scheduled ON hour, the light stays off regardless of schedule.

| Byte | Field | Type | Range | Description |
|---|---|---|---|---|
| 0 | version | uint8 | 0x01 | Payload version |
| 1 | cmd | uint8 | 0x06 | Command byte |
| 2 | on_hour | uint8 | 0–23 | Schedule ON hour (24h, local time) |
| 3 | off_hour | uint8 | 0–23 | Schedule OFF hour (24h, local time) |

**Constraints:**
- Valid range: 0–23. The REST API performs pre-dispatch validation; values outside this range return 422 Unprocessable and are not transmitted. The device sends a NACK (InvalidParam) only if a malformed frame bypasses validation.
- Minute-level precision is not supported — schedule operates in whole hours only
- Photocell input takes precedence: light will not turn ON if ambient lux exceeds threshold even within scheduled hours
- Persists to NVS on successful receipt; NVS failure sends NACK and discards the command

**Example:** Schedule ON at 18:00 (0x12), OFF at 06:00 (0x06)
```
01 06 12 06
```

---

### 0x07 — REQUEST_UPLINK

Request an immediate status uplink from the device. Device responds with current sensor readings and status. Does not affect FSM state.

| Byte | Field | Type | Range | Description |
|---|---|---|---|---|
| 0 | version | uint8 | 0x01 | Payload version |
| 1 | cmd | uint8 | 0x07 | Command byte |

**Constraints:**
- Rate limiting is enforced by the Cloud API (1 request per 60 seconds)
- Device processes all received 0x07 commands immediately with a telemetry uplink.

**Example:**
```
01 07
```

---

### 0x08 — REBOOT

Force a device restart. Device sends an ACK uplink before restarting.

| Byte | Field | Type | Range | Description |
|---|---|---|---|---|
| 0 | version | uint8 | 0x01 | Payload version |
| 1 | cmd | uint8 | 0x08 | Command byte |

**Behaviour:**
1. Device receives REBOOT command
2. Device sends ACK uplink (see ACK/NACK format below)
3. Device waits for uplink transmission to complete (SF7 ~100 ms, SF12 ~2500 ms)
4. Device calls `esp_restart()`

**Example:**
```
01 08
```

---

### 0x09 — SET_MOTION_SENSITIVITY

Remotely configure the mmWave motion sensor detection sensitivity.

| Byte | Field | Type | Range | Description |
|---|---|---|---|---|
| 0 | version | uint8 | 0x01 | Payload version |
| 1 | cmd | uint8 | 0x09 | Command byte |
| 2 | level | uint8 | 0–10 | Sensitivity level (0 = minimum, 10 = maximum) |

**Constraints:**
- Valid range: 1-10. The REST API performs pre-dispatch validation; values outside this range return 422 Unprocessable and are not transmitted. The device sends a NACK (InvalidParam) only if a malformed frame bypasses validation.
- Persists to NVS on successful receipt; NVS failure sends NACK and discards the command
- Applied on next reboot — mmWave sensor is reconfigured at startup

**Example:** Set sensitivity to 7 (0x07)
```
01 09 07
```

---

### 0x0A — SET_HEARTBEAT_INTERVAL

Configure how frequently the device sends a status uplink when idle and no events are occurring.

| Byte | Field | Type | Range | Description |
|---|---|---|---|---|
| 0 | version | uint8 | 0x01 | Payload version |
| 1 | cmd | uint8 | 0x0A | Command byte |
| 2 | interval_minutes | uint8 | 1–255 | Heartbeat interval in minutes |

**Constraints:**
- Valid range: 1–255. The REST API performs pre-dispatch validation; values outside this range return 422 Unprocessable and are not transmitted. The device sends a NACK (InvalidParam) only if a malformed frame bypasses validation.
- Persists to NVS on successful receipt; NVS failure sends NACK and discards the command
- LoRaWAN duty cycle limits take precedence — firmware will not violate duty cycle regardless of configured interval

**Example:** Set heartbeat to every 5 minutes (0x05)
```
01 0A 05
```

---

### 0x0B — SET_TEMP_DIM

Apply a temporary dim level override that automatically expires after a specified duration.

| Byte | Field | Type | Range | Description |
|---|---|---|---|---|
| 0 | version | uint8 | 0x01 | Payload version |
| 1 | cmd | uint8 | 0x0B | Command byte |
| 2 | level | uint8 | 0–100 | Temporary dim level % |
| 3 | duration_hours | uint8 | 1–24 | Duration in hours before auto-expiry |

**Constraints:**
- Does not enter MANUAL state — FSM remains in AUTO, only dim level is overridden
- Level 0 is permitted — temporarily extinguishes light while keeping FSM in AUTO
- Motion events still trigger max level during the temp dim window
- On expiry, dim level returns to the value configured by SET_LEVELS
- Does not persist to NVS — a reboot during the window returns to the SET_LEVELS dim value

**Example:** Dim to 20% (0x14) for 3 hours (0x03)
```
01 0B 14 03
```

---

## CMD Quick Reference

| CMD | Command | Parameters | Frame Bytes |
|---|---|---|---|
| 0x01 | SET_LEVELS | max_level, dim_level | 4 |
| 0x02 | SET_MOTION_TIMEOUT | timeout (2 bytes, big-endian) | 4
| 0x03 | OVERRIDE_ON | level | 3 |
| 0x04 | OVERRIDE_OFF | — | 2 |
| 0x05 | RESUME_AUTO | — | 2 |
| 0x06 | SET_SCHEDULE | on_hour, off_hour | 4 |
| 0x07 | REQUEST_UPLINK | — | 2 |
| 0x08 | REBOOT | — | 2 |
| 0x09 | SET_MOTION_SENSITIVITY | level (0–10) | 3 |
| 0x0A | SET_HEARTBEAT_INTERVAL | interval_minutes uint8 | 3 |
| 0x0B | SET_TEMP_DIM | level, duration_hours | 4 |
| 0x0C–0xFF | Reserved | — | — |

---

## Error Handling

| Condition | Firmware Behaviour |
|---|---|
| Payload version mismatch | Discard packet, send NACK (reason: InvalidVersion) |
| Unknown CMD byte | Discard packet, send NACK (reason: InvalidCmd) |
| Invalid parameter range | Discard packet, send NACK (reason: InvalidParam) |
| Payload too short | Discard packet, send NACK (reason: PayloadTooShort) |
| NVS write failure | Discard command (not applied), send NACK (reason: NvsError) |

> **Note:** NVS write failures result in a NACK and the command is not applied — the in-memory config is not updated. This ensures the device state and NVS remain consistent.

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

**Version:** 1.0  
**Last Updated:** March 19, 2026  
**Byte Order:** Big-endian (MSB first)

---

## Overview

The device supports two uplink payload tiers selected at firmware build time. The backend Lambda identifies the tier from `payload[0]` (version byte) and routes accordingly. Both tiers are mutually exclusive — a device runs one tier for its entire operational life unless reflashed.

| Tier | Version Byte | Capabilities |
|---|---|---|
| Uplink-only | `0x01` | Telemetry uplinks only — no downlink command processing |
| Full | `0x02` | Telemetry uplinks + ACK/NACK command responses |

---

## Version 0x01 — Uplink-Only Tier

### Frame Format (7 bytes)

```
┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│ Byte 0   │ Byte 1–2 │ Byte 3   │ Byte 4   │ Byte 5   │ Byte 6   │
│ Version  │ lux_x10  │ tempC    │ humidity │ flags    │ level    │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
```

| Byte | Field | Type | Description |
|---|---|---|---|
| 0 | version | uint8 | Always `0x01` |
| 1–2 | lux_x10 | uint16 BE | Ambient light × 10 (e.g. 1234 = 123.4 lux) |
| 3 | tempC | int8 | Temperature in °C (signed) |
| 4 | humidity | uint8 | Relative humidity 0–100% |
| 5 | flags | uint8 | Status bitmask (see Flags) |
| 6 | lightLevel | uint8 | Current light output 0–100% |

---

## Version 0x02 — Full Tier

Version 0x02 frames include a `type` byte at position 1 to distinguish telemetry from ACK/NACK responses.

```
┌──────────┬──────────┬──────────────────────────┐
│ Byte 0   │ Byte 1   │ Byte 2 .. N              │
│ Version  │ Type     │ Payload                  │
└──────────┴──────────┴──────────────────────────┘
```

| Type Byte | Frame Type | Total Bytes |
|---|---|---|
| `0x01` | Telemetry | 8 |
| `0x02` | ACK/NACK | 5 |

---

### V2 Type 0x01 — Telemetry (8 bytes)

| Byte | Field | Type | Description |
|---|---|---|---|
| 0 | version | uint8 | Always `0x02` |
| 1 | type | uint8 | Always `0x01` (telemetry) |
| 2–3 | lux_x10 | uint16 BE | Ambient light × 10 (e.g. 1234 = 123.4 lux) |
| 4 | tempC | int8 | Temperature in °C (signed) |
| 5 | humidity | uint8 | Relative humidity 0–100% |
| 6 | flags | uint8 | Status bitmask (see Flags) |
| 7 | lightLevel | uint8 | Current light output 0–100% |

---

### V2 Type 0x02 — ACK/NACK (5 bytes)

Sent by the device immediately after processing a downlink command. Stored in DynamoDB command audit table only — not forwarded to InfluxDB.

| Byte | Field | Type | Description |
|---|---|---|---|
| 0 | version | uint8 | Always `0x02` |
| 1 | type | uint8 | Always `0x02` (ACK/NACK) |
| 2 | responseCode | uint8 | `0x00` = ACK, `0x01` = NACK |
| 3 | echoCmd | uint8 | CMD byte from the downlink being acknowledged |
| 4 | reasonCode | uint8 | See Reason Codes below |

#### Response Codes

| Value | Meaning |
|---|---|
| `0x00` | ACK — command accepted and applied |
| `0x01` | NACK — command rejected |

#### Reason Codes

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
02 02 00 01 00
```

**Example — NACK for SET_LEVELS (invalid parameter):**
```
02 02 01 01 03
```

**Example — NACK for unknown version:**
```
02 02 01 05 01
```
*(echoCmd = 0x05 = ResumeAuto sentinel used when no valid CMD can be echoed)*

---

## Status Flags (both versions)

The `flags` byte is a bitmask present in all telemetry frames.

| Bit | Mask | Name | Meaning |
|---|---|---|---|
| 0 | `0x01` | MotionPresent | Motion currently detected |
| 1 | `0x02` | AmbientPrimaryOk | Primary ALS sensor healthy |
| 2 | `0x04` | AmbientSecondaryOk | Secondary ALS sensor healthy |
| 3 | `0x08` | ThOk | Temperature/humidity sensor healthy |
| 4 | `0x10` | MotionPrimaryOk | Primary mmWave sensor healthy |
| 5 | `0x20` | MotionSecondaryOk | Secondary mmWave sensor healthy |
| 6 | `0x40` | SystemDegraded | One or more sensors degraded or partial failure |
| 7 | `0x80` | OverallOk | All sensors healthy, FSM not in Fault state |

**Healthy system with no motion:** `flags = 0xBE` (bits 1–5 + 7 set)  
**Motion detected, all healthy:** `flags = 0xBF` (bits 0–5 + 7 set)  
**Primary ALS failed:** `flags = 0x7C` (bits 2–5 + 6 set, bits 1 + 7 clear)

---

## Database Routing Summary

| Frame | InfluxDB | DynamoDB |
|---|---|---|
| V1 Telemetry | ✓ (time series) | ✓ (device state) |
| V2 Telemetry | ✓ (time series) | ✓ (device state) |
| V2 ACK/NACK | ✗ | ✓ (command audit trail) |