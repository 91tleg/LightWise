# WebSocket API
**Version:** 1.0  
**Last Updated:** March 13, 2026  

Route selection: API Gateway routes on the `action` field in the message body.

See [README.md](./README.md) for shared conventions.

---

## Routes

### `$connect`

Establishes a WebSocket connection. Stores the connection in DynamoDB.

**Query Parameters**
| Parameter | Type | Required | Description |
|---|---|---|---|
| `tenant_id` | string | demo only | Tenant identifier — will be replaced by Cognito token before production |

**Response**
`HTTP 200` on success, `HTTP 401` if auth fails.

---

### `$disconnect`

Called automatically when the client disconnects. Cleans up the connection from DynamoDB.

No parameters required.

---

### `subscribe`

Subscribes the connection to real-time telemetry for a specific streetlight.

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
| `500` | Unexpected error |

---

## Server Push

### Telemetry Event

Sent by the server to all subscribed connections on each uplink from a streetlight.

```json
{
  "tenant_id": "tenant-001",
  "streetlight_id": "LW-00042",
  "timestamp": "2026-02-27T03:41:12+00:00",
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
