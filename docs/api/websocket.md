# WebSocket API

**Version:** 1.2  
**Last Updated:** March 20, 2026  
Route selection: API Gateway routes on the `action` field in the message body.
See [README.md](./README.md) for shared conventions.

---

## Changelog

| Version | Date | Author | Changes |
|---|---|---|---|
| 1.1 | 2026-03-20 | — | Clarified subscription fan-out mechanism; clarified timeout ownership (API-driven, not client-side); added note that a single `subscribe` action covers both telemetry and command ACK/NACK events; added `params` omission rationale to command.ack event |
| 1.2 | 2026-03-21 | — | Replaced query parameter auth with Cognito JWT via Lambda authorizer on `$connect`; documented `Sec-WebSocket-Protocol` header pattern; added authorizer caching note; added `403` to subscribe responses; removed demo-only `tenant_id` query parameter |

---

## Overview

A single WebSocket connection and a single `subscribe` action covers both telemetry
and command ACK/NACK events for a streetlight. There is no separate route for commands.
The `event` field in each server push distinguishes event types on the client side.

**Fan-out mechanism:** when a client subscribes to a streetlight, the connection ID is
stored in DynamoDB against that `streetlight_id`. When an uplink or command ACK arrives
for that streetlight, the Lambda queries DynamoDB for all subscribed connection IDs and
pushes to each. Multiple frontend clients subscribed to the same streetlight all receive
the same events.

---

## Routes

### `$connect`

Establishes a WebSocket connection. Authentication is handled by a Lambda authorizer
attached to this route in API Gateway — the connection is rejected before the handler
runs if the token is missing or invalid.

**Authentication**

The browser `WebSocket` API does not support custom headers, so the Cognito ID token
is passed via the `Sec-WebSocket-Protocol` header using the standard workaround:

```javascript
const token = await Auth.currentSession().then(s => s.getIdToken().getJwtToken());
const ws = new WebSocket('wss://api.example.com/ws', ['Bearer', token]);
```

The Lambda authorizer validates the token against Cognito, extracts `tenant_id` from
the JWT claims, and passes it to the `$connect` handler via `requestContext.authorizer`.
The `tenant_id` is then stored in DynamoDB alongside the connection ID — it is never
supplied directly by the client.

**Authorizer caching:** API Gateway caches the auth result per connection for a
configurable TTL (default 300 s). If the Cognito token expires mid-session the
connection remains open until closed and reconnected. Set the authorizer TTL to be
less than or equal to your Cognito token expiry to bound the drift window.

**No query parameters required.**

**Response**

`HTTP 200` on success, `HTTP 401` if the token is missing or fails validation.

---

### `$disconnect`

Called automatically when the client disconnects. Cleans up the connection from DynamoDB.

No parameters required.

---

### `subscribe`

Subscribes the connection to real-time telemetry and command ACK/NACK events for a
specific streetlight. Both event types are delivered on the same connection — no
separate subscription is needed for commands.

**Message**

```json
{
  "action": "subscribe",
  "streetlight_id": "LW-00042"
}
```

**Response**

| Status | Meaning |
|---|---|
| `200` | Subscribed successfully — body: `"subscribed"` |
| `400` | `streetlight_id` missing |
| `401` | Auth failed |
| `403` | Caller's tenant does not own this streetlight |
| `500` | Unexpected error |

---

## Server Push

### Telemetry Event

Sent to all subscribed connections on each uplink received from a streetlight.

```json
{
  "tenant_id": "tenant-001",
  "streetlight_id": "LW-00042",
  "timestamp": "2026-02-27T03:41:12+00:00",
  "event": "telemetry",
  "health": "DEGRADED",
  "data": {
    "lux": 123.4,
    "temp_c": 25,
    "humidity": 60,
    "motion": true,
    "light_level": 80
  },
  "diagnostics": {
    "overall_ok": true,
    "system_degraded": false,
    "ambient_primary_ok": true,
    "ambient_secondary_ok": false,
    "th_ok": true,
    "motion_primary_ok": true,
    "motion_secondary_ok": true
  }
}
```

**Health values:** `OK`, `DEGRADED`, `CRITICAL`

---

### Command ACK/NACK Event

Sent to all subscribed connections when the device responds to a dispatched downlink
command. The `command_id` matches the value returned by
`POST /streetlights/{id}/commands` and is the correlation key between the REST
dispatch, this push event, and the GET history record.

Because LoRaWAN is asynchronous, this event may arrive seconds to minutes after the
REST call — or not at all if the device is unreachable. The API marks a command as
`timeout` after 5 minutes with no device response and updates the GET history record
accordingly. The frontend does not need to implement its own timeout timer — it can
rely on the API-driven status. Any device response arriving after the timeout window
is discarded.

See [commands.md](./commands.md) for the full command dispatch flow.

**ACK — command accepted:**

```json
{
  "tenant_id": "tenant-001",
  "streetlight_id": "LW-00042",
  "timestamp": "2026-03-19T14:00:45Z",
  "event": "command.ack",
  "data": {
    "command_id": "cmd-uuid-001",
    "command": "SET_LEVELS",
    "response_code": "ACK",
    "reason_code": "Ok"
  }
}
```

**NACK — command rejected:**

```json
{
  "tenant_id": "tenant-001",
  "streetlight_id": "LW-00042",
  "timestamp": "2026-03-19T14:00:45Z",
  "event": "command.ack",
  "data": {
    "command_id": "cmd-uuid-001",
    "command": "SET_LEVELS",
    "response_code": "NACK",
    "reason_code": "NvsError"
  }
}
```

Note: the `command.ack` event does not include the original `params`. The frontend
should use `command_id` to look up the full dispatch record from GET history if
params are needed for display.

**Reason code values:** see [commands.md — Reason Code Reference](./commands.md#reason-code-reference)
