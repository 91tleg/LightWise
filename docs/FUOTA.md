# FUOTA — Firmware Update Over The Air

## Overview

FUOTA delivers firmware updates to deployed streetlight nodes via LoRaWAN
downlink. The update binary is fragmented by AWS IoT Wireless and delivered
as standard LoRaWAN downlinks on FPort 1. The device reassembles fragments,
verifies integrity, and commits the new firmware to a secondary OTA partition
before rebooting.

Delta patching is deferred — the full binary is sent each update cycle.
At current firmware size (~320KB) and LoRaWAN SF10 US915 throughput this
completes in approximately 2–4 hours under normal network conditions.

---

## Architecture

```
AWS IoT Wireless
  └── fragments binary via TS004
        └── LoRaWAN downlink (FPort 1)
              └── downlink_task
                    └── decodeAndDispatch
                          └── FuotaSession
                                ├── fragment bitmap (static, BSS)
                                ├── hal::otaWrite  (esp_fuota_hal.cpp)
                                └── hal::crc32Update

ESP32-S3 Flash
  ├── ota_0  (running firmware)
  └── ota_1  (FUOTA target — written during session)
```

HAL calls resolve at link time. `esp_fuota_hal.cpp` provides strong symbols
for device builds. `stub_fuota_hal.cpp` provides strong symbols for tests.
No function pointers. No virtual dispatch.

---

## Partition Layout

```
# partitions.csv
nvs,      data, nvs,      0x9000,   0x6000
otadata,  data, ota,      0xF000,   0x2000
ota_0,    app,  ota_0,    0x10000,  0x180000   # 1.5MB running firmware
ota_1,    app,  ota_1,    0x190000, 0x180000   # 1.5MB FUOTA target
nvs_keys, data, nvs_keys, 0x310000, 0x10000
```

Both OTA partitions are 1.5MB. Current firmware is ~320KB leaving
approximately 1.18MB headroom for growth before partition resize is needed.

---

## Downlink Protocol

All downlinks follow the existing V1 frame format:

```
Byte 0 : version = 0x01
Byte 1 : command (DownlinkCmd enum)
Byte 2+: parameters (command-specific)
```

### FuotaSessionSetup (0x0B)

Sent once before fragments begin. Opens the OTA partition and initialises
the fragment bitmap.

```
Byte 2   : total_fragments high byte
Byte 3   : total_fragments low byte
Byte 4   : fragment_size (bytes, max 47 at SF10 US915)
Byte 5   : target_crc32 byte 3 (MSB)
Byte 6   : target_crc32 byte 2
Byte 7   : target_crc32 byte 1
Byte 8   : target_crc32 byte 0 (LSB)
```

Device responds with ACK on success, NACK on invalid params or flash error.

### FuotaFragment (0x0C)

One downlink per fragment. Delivered continuously by AWS IoT Wireless.

```
Byte 2   : fragment_index high byte
Byte 3   : fragment_index low byte
Byte 4+  : fragment payload (up to 47 bytes at SF10 US915)
```

No ACK per fragment — device sends FUOTA_MISSING uplink if gaps detected.

---

## Uplink Protocol

All FUOTA uplinks use version 0x01 with distinct type bytes.

### FuotaMissing (type=0x02)

Sent when a gap is detected in the received fragment bitmap. Reports the
first contiguous run of missing fragments. AWS retransmits that run.

```
Byte 0   : version = 0x01
Byte 1   : type    = 0x02
Byte 2   : first_missing high byte
Byte 3   : first_missing low byte
Byte 4   : missing_count high byte
Byte 5   : missing_count low byte
```

### FuotaComplete (type=0x03)

Sent when all fragments received and CRC32 verified. Precedes commit and
reboot.

```
Byte 0   : version = 0x01
Byte 1   : type    = 0x03
Byte 2   : crc32 byte 3 (MSB)
Byte 3   : crc32 byte 2
Byte 4   : crc32 byte 1
Byte 5   : crc32 byte 0 (LSB)
```

### FuotaError (type=0x04)

Sent on session failure. Session is aborted after sending.

```
Byte 0   : version = 0x01
Byte 1   : type    = 0x04
Byte 2   : error_code (see FuotaErrorCode)
```

Error codes:

| Code           | Value | Meaning                                   |
|----------------|-------|-------------------------------------------|
| CrcMismatch    | 0x01  | CRC32 of received binary did not match    |
| FlashError     | 0x02  | esp_ota_write or esp_partition_read failed |
| SessionInvalid | 0x03  | Fragment received with no active session  |
| FragmentTooBig | 0x04  | Fragment payload exceeds fragment_size    |

### FuotaAck (type=0x05)

Reserved. Sent after new firmware boots successfully and marks itself valid.
Not yet implemented — backend infers success from next telemetry uplink
containing updated firmware version.

```
Byte 0   : version = 0x01
Byte 1   : type    = 0x05
```

---

## Session State Machine

```
         begin()
Idle ──────────────────────────────→ Receiving
 ↑                                       │
 │ abort()           onFragment() ───────┤ (fragments arriving)
 │                                       │
 │                   isComplete() ───────→ Verifying
 │                                       │
 │                   verify() ok ────────→ Complete
 │                                       │
 │                   verify() fail ──────→ Error ──→ abort() ──→ Idle
 │                                       │
 │                   commit() ok ────────→ [ reboot — does not return ]
 │                                       │
 └───────────────── commit() fail ───────→ Error
 └───────────────── abort() ─────────────┘ (valid from any state)
```

State transitions are validated by `FuotaSession::transition()`. Invalid
transitions are logged and rejected — state is never silently corrupted.

---

## Fragment Bitmap

The fragment bitmap is a static `std::array<uint8_t, kBitmapBytes>` in BSS.
One bit per fragment. No heap allocation.

```
kOtaPartitionBytes = 0x180000  (1.5MB)
kMinFragmentSize   = 1
kMaxFragments      = 1572864
kBitmapBytes       = 196608    (192KB)
```

`FuotaSession` is declared as a function-scope static in `downlink_task`
so the bitmap lives in BSS, not on the task stack.

---

## Airtime Impact

FUOTA increases radio activity significantly. During an active session the
uplink heartbeat interval is reduced to 60 seconds regardless of the
configured `heartbeatMin`. This keeps the dashboard alive while giving
FUOTA_MISSING reports priority over telemetry.

Normal heartbeat interval resumes automatically when the session ends
(complete, error, or abort).

---

## Rollback

The bootloader validates new firmware on first boot. If the new firmware
fails to call `esp_ota_mark_app_valid_cancel_rollback()` within the watchdog
window, the bootloader reverts to `ota_0` on the next reset.

`device_init.cpp` calls `markFirmwareValid()` after LoRaWAN join succeeds
and all managers initialise cleanly. A firmware that cannot join the network
or initialise sensors will be rolled back automatically.

---

## Triggering a FUOTA Job

```bash
# Upload firmware binary to S3
aws s3 cp firmware-v1.1.0.bin s3://<bucket>/firmware/firmware-v1.1.0.bin

# Create FUOTA job
aws iotwireless create-fuota-task \
  --name "lightwise-v1.1.0" \
  --firmware-update-image "s3://<bucket>/firmware/firmware-v1.1.0.bin" \
  --firmware-update-role  "arn:aws:iam::<account>:role/iotwireless-fuota-role" \
  --lorawan '{
    "RfRegion": "US915",
    "StartTime": "2026-05-18T10:00:00Z",
    "FragmentSizeBytes": 47,
    "FragmentIntervalMS": 1000
  }'

# Associate device with FUOTA job
aws iotwireless start-fuota-task \
  --id <fuota-task-id> \
  --lorawan '{
    "DeviceList": [
      { "Id": "<wireless-device-id>", "Type": "WirelessDevice" }
    ]
  }'
```

`FragmentSizeBytes` must match `fragment_size` in the `FuotaSessionSetup`
downlink. Set to 47 for SF10 US915. Adjust for other spreading factors.

---

## Constraints and Limitations

- Delta patching not implemented — full binary sent each update cycle
- Single active session — a new `FuotaSessionSetup` aborts any in-progress session
- No per-fragment ACK — gaps reported via FUOTA_MISSING after each received fragment
- FuotaAck uplink reserved but not yet sent — version confirmed via next telemetry
- Maximum fragment size 47 bytes at SF10 US915 — must match AWS FUOTA job config
- Firmware must fit within 1.5MB OTA partition — current usage ~320KB
