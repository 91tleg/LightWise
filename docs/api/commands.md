# Commands API

**Version:** 1.1
**Last Updated:** March 20, 2026
See [README.md](./README.md) for shared conventions.

---

## Changelog

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.0 | 2026-03-20 | Max Chou | Initial specification |

---

## Overview

Commands are dispatched to a streetlight over LoRaWAN downlink. Because LoRaWAN is
asynchronous, the REST endpoint returns `202 Accepted` immediately — the device ACK
or NACK is delivered later via WebSocket `command.ack` push.

```
Frontend              REST API            Lambda            Device (LoRaWAN)
   │                      │                   │                    │
   │── POST /commands ───▶│                   │                    │
   │◀── 202 Accepted ─────│                   │                    │
   │    (command_id)      │                   │                    │
   │                      │                   │◀── ACK/NACK uplink─│
   │◀── WS command.ack ───│◀──────────────────│                    │
   │    (command_id echo) │                   │                    │
```

The `command_id` returned by `POST` is the correlation key across the full lifecycle:
it is echoed in the WebSocket `command.ack` event and stored in the GET history, allowing
the frontend to match a dispatch to its device response without ambiguity — including
when multiple commands of the same type are in flight simultaneously.

See [websocket.md](./websocket.md) for the `command.ack` push event.

---

## Common Response Codes

| Code | Meaning |
|---|---|
| `202` | Accepted — command dispatched, ACK/NACK delivered asynchronously via WebSocket |
| `400` | Bad request — missing or malformed body |
| `401` | Unauthorized — missing or invalid token |
| `403` | Forbidden — caller lacks permission for this streetlight |
| `404` | Streetlight not found |
| `409` | Conflict — rate limit exceeded (REQUEST_UPLINK only) |
| `422` | Unprocessable — parameters violate device constraints; command not dispatched and no `command_id` is generated |

---

## `POST /streetlights/{id}/commands`

Dispatch a downlink command to a streetlight.

Parameter and constraint validation is performed before dispatch. A `422` is returned
for invalid parameters — the command is never sent to the device, no `command_id` is
generated, and the command does not appear in GET history.

**Path Parameters**

| Parameter | Type | Description |
|---|---|---|
| `id` | string | Streetlight identifier |

**Request Body**

```json
{
  "command": "<COMMAND_NAME>",
  "params": { }
}
```

**Response `202`**

```json
{
  "command_id": "cmd-uuid-001",
  "streetlight_id": "LW-00042",
  "command": "SET_LEVELS",
  "status": "pending",
  "dispatched_at": "2026-03-19T14:00:00Z"
}
```

**Response `422`**

```json
{
  "error": "InvalidParam",
  "message": "max_level must be between 1 and 100",
  "field": "max_level",
  "received": 0
}
```

---

### Command Reference

All commands follow the same envelope — only `params` varies.

---

#### `SET_LEVELS`

Configure max brightness and baseline dim level. Persists to NVS.

```json
{
  "command": "SET_LEVELS",
  "params": {
    "max_level": 90,
    "dim_level": 20
  }
}
```

| Field | Type | Range | Description |
|---|---|---|---|
| `max_level` | uint8 | 1–100 | Max brightness % (motion active or scheduled ON) |
| `dim_level` | uint8 | 0–100 | Baseline dim % when idle |

Constraints: `dim_level` ≤ `max_level`. `max_level` minimum is 1 — use `OVERRIDE_OFF` to force light off.

---

#### `SET_MOTION_TIMEOUT`

Configure how long the light stays at max level after the last motion event. Persists to NVS.

```json
{
  "command": "SET_MOTION_TIMEOUT",
  "params": {
    "timeout_seconds": 30
  }
}
```

| Field | Type | Range | Description |
|---|---|---|---|
| `timeout_seconds` | uint16 | 15–3600 | Seconds at max after last motion |

---

#### `OVERRIDE_ON`

Force the light ON at a specified level. Enters MANUAL state. Does not persist — a reboot returns to AUTO.

```json
{
  "command": "OVERRIDE_ON",
  "params": {
    "level": 100
  }
}
```

| Field | Type | Range | Description |
|---|---|---|---|
| `level` | uint8 | 1–100 | Brightness % |

Safety: MANUAL state auto-expires after 8 hours if `RESUME_AUTO` is not received.

---

#### `OVERRIDE_OFF`

Force the light OFF. Enters MANUAL state. Does not persist — a reboot returns to AUTO.

```json
{
  "command": "OVERRIDE_OFF",
  "params": {}
}
```

Safety: MANUAL state auto-expires after 8 hours. There is no command that permanently disables a pole.

---

#### `RESUME_AUTO`

Clear any active manual override and return the FSM to AUTO mode immediately.

```json
{
  "command": "RESUME_AUTO",
  "params": {}
}
```

---

#### `SET_SCHEDULE`

Configure the daily ON and OFF schedule in whole hours. Photocell takes precedence —
the light will not turn ON if ambient lux exceeds threshold even within scheduled hours.
Persists to NVS.

```json
{
  "command": "SET_SCHEDULE",
  "params": {
    "on_hour": 18,
    "off_hour": 6
  }
}
```

| Field | Type | Range | Description |
|---|---|---|---|
| `on_hour` | uint8 | 0–23 | Schedule ON hour (24h local time) |
| `off_hour` | uint8 | 0–23 | Schedule OFF hour (24h local time) |

Note: minute-level precision is not supported.

---

#### `REQUEST_UPLINK`

Request an immediate telemetry uplink. The device responds with a full telemetry frame,
not an ACK frame. Rate limited to 1 request per 60 seconds.

```json
{
  "command": "REQUEST_UPLINK",
  "params": {}
}
```

Returns `409 Conflict` if the rate limit is exceeded. The device does not send a NACK
for rate-limited requests — the `409` is generated by the API before dispatch.

---

#### `REBOOT`

Force a device restart. The device sends an ACK uplink before restarting. Transmission
wait is spreading-factor dependent (SF7 ~100 ms, SF12 ~2500 ms).

```json
{
  "command": "REBOOT",
  "params": {}
}
```

---

#### `SET_MOTION_SENSITIVITY`

Configure the mmWave sensor detection sensitivity. Persists to NVS. Applied on next reboot.

```json
{
  "command": "SET_MOTION_SENSITIVITY",
  "params": {
    "sensitivity": 7
  }
}
```

| Field | Type | Range | Description |
|---|---|---|---|
| `sensitivity` | uint8 | 1–10 | 1 = minimum, 10 = maximum |

---

#### `SET_HEARTBEAT_INTERVAL`

Configure how frequently the device sends a telemetry uplink when idle. Persists to NVS.
LoRaWAN duty cycle limits take precedence.

```json
{
  "command": "SET_HEARTBEAT_INTERVAL",
  "params": {
    "interval_minutes": 60
  }
}
```

| Field | Type | Range | Description |
|---|---|---|---|
| `interval_minutes` | uint8 | 1–255 | Heartbeat interval in minutes |

---

#### `SET_TEMP_DIM`

Apply a temporary dim override that auto-expires. FSM remains in AUTO — motion still
triggers max level. Does not persist — a reboot returns to the `SET_LEVELS` dim value.

```json
{
  "command": "SET_TEMP_DIM",
  "params": {
    "level": 20,
    "duration_hours": 3
  }
}
```

| Field | Type | Range | Description |
|---|---|---|---|
| `level` | uint8 | 0–100 | Temporary dim level % (0 = off while in AUTO) |
| `duration_hours` | uint8 | 1–24 | Hours before auto-expiry |

---

## `GET /streetlights/{id}/commands`

Retrieve command history and ACK/NACK audit trail for a streetlight. Queries DynamoDB.
Only commands that were dispatched (i.e. received `202`) appear in history — commands
rejected with `422` are never recorded.

**Path Parameters**

| Parameter | Type | Description |
|---|---|---|
| `id` | string | Streetlight identifier |

**Query Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `from` | ISO 8601 | no | Start of range (default: 24 h ago) |
| `to` | ISO 8601 | no | End of range (default: now) |
| `status` | string | no | Filter: `pending`, `acked`, `nacked`, `timeout` |

**Response `200`**

```json
{
  "streetlight_id": "LW-00042",
  "commands": [
    {
      "command_id": "cmd-uuid-001",
      "dispatched_at": "2026-03-19T13:00:00Z",
      "command": "SET_LEVELS",
      "params": {
        "max_level": 90,
        "dim_level": 20
      },
      "status": "acked",
      "response": {
        "received_at": "2026-03-19T13:00:45Z",
        "response_code": "ACK",
        "reason_code": "Ok"
      }
    },
    {
      "command_id": "cmd-uuid-002",
      "dispatched_at": "2026-03-19T13:05:00Z",
      "command": "SET_LEVELS",
      "params": {
        "max_level": 90,
        "dim_level": 20
      },
      "status": "nacked",
      "response": {
        "received_at": "2026-03-19T13:05:38Z",
        "response_code": "NACK",
        "reason_code": "NvsError"
      }
    },
    {
      "command_id": "cmd-uuid-003",
      "dispatched_at": "2026-03-19T14:00:00Z",
      "command": "OVERRIDE_ON",
      "params": {
        "level": 100
      },
      "status": "pending",
      "response": null
    }
  ]
}
```

**Status values:**

| Status | Meaning |
|---|---|
| `pending` | Command dispatched, no device response yet |
| `acked` | Device accepted and applied the command |
| `nacked` | Device rejected the command |
| `timeout` | API marked the command timed out after 5 minutes with no device response — the device may still respond later but the response will be discarded |

---

## Reason Code Reference

Returned in `response.reason_code` in the command history and echoed in the WebSocket
`command.ack` event.

| Code | Meaning |
|---|---|
| `Ok` | Command accepted and applied |
| `InvalidVersion` | Downlink version byte not recognised by device |
| `InvalidCmd` | CMD byte not recognised by device |
| `InvalidParam` | Parameter out of valid range or constraint violated |
| `NvsError` | NVS write failed — command not applied |
| `FsmError` | FSM rejected the state transition |
| `PayloadTooShort` | Frame shorter than minimum for this command |

Note: `timeout` is a command status, not a device reason code. A timed-out command has
no `reason_code` — the `response` field in GET history will be `null`.

---

## NVS Persistence Summary

| Command | Persists to NVS | Takes Effect |
|---|---|---|
| `SET_LEVELS` | Yes | Immediately |
| `SET_MOTION_TIMEOUT` | Yes | Immediately |
| `OVERRIDE_ON` | No | Immediately |
| `OVERRIDE_OFF` | No | Immediately |
| `RESUME_AUTO` | No | Immediately |
| `SET_SCHEDULE` | Yes | Immediately |
| `REQUEST_UPLINK` | No | One-time |
| `REBOOT` | No | After ACK uplink |
| `SET_MOTION_SENSITIVITY` | Yes | Next reboot |
| `SET_HEARTBEAT_INTERVAL` | Yes | Immediately |
| `SET_TEMP_DIM` | No | Immediately, expires after duration |