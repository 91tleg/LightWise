# API Contract

This document describes the HTTP and WebSocket API endpoints for the LightWise backend.

**Base URL (local):** `http://localhost:3000`  
**WebSocket URL (local):** `ws://localhost:3001`  
**Auth:** Disabled for demo. Pass `tenant_id` as a query parameter on all requests.

---

## HTTP API

### `GET /streetlights`

Returns all streetlights for a tenant. Used to render the map with pins and health indicators.

**Query Parameters**

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `tenant_id` | string | yes | Tenant identifier |

**Response `200`**
```json
[
  {
    "streetlight_id": "LW-00042",
    "tenant_id": "tenant-001",
    "health": "DEGRADED",
    "lat": 37.7749,
    "lng": -122.4194,
    "name": "Main Street 5th Ave",
    "last_seen": "2026-02-27T03:41:12+00:00",
    "motion_detected": true,
    "ambient_primary_ok": true,
    "ambient_secondary_ok": false,
    "th_ok": true,
    "motion_primary_ok": true,
    "motion_secondary_ok": true
  }
]
```

**Health values:** `OK`, `DEGRADED`, `CRITICAL`

---

### `GET /streetlights/{id}`

Returns full detail for a single streetlight. Used when a user clicks a map pin.

**Path Parameters**

| Parameter | Type | Description |
| --- | --- | --- |
| `id` | string | Streetlight identifier |

**Query Parameters**

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `tenant_id` | string | yes | Tenant identifier |

**Response `200`**
```json
{
  "streetlight_id": "LW-00042",
  "tenant_id": "tenant-001",
  "health": "DEGRADED",
  "lat": 37.7749,
  "lng": -122.4194,
  "name": "Main Street 5th Ave",
  "last_seen": "2026-02-27T03:41:12+00:00",
  "motion_detected": true,
  "ambient_primary_ok": true,
  "ambient_secondary_ok": false,
  "th_ok": true,
  "motion_primary_ok": true,
  "motion_secondary_ok": true
}
```

**Response `404`**
```json
{ "error": "Streetlight not found" }
```

---

### `GET /streetlights/{id}/telemetry`

Returns time-series sensor data for charts. Hits Timestream. Returns empty array when Timestream is not configured (local/demo).

**Path Parameters**

| Parameter | Type | Description |
| --- | --- | --- |
| `id` | string | Streetlight identifier |

**Query Parameters**

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `from` | ISO 8601 | yes | Start of time range |
| `to` | ISO 8601 | yes | End of time range |
| `interval` | string | no | Aggregation interval. Default `5m`. One of `1m`, `5m`, `15m`, `1h`, `1d` |

**Response `200`**
```json
{
  "streetlight_id": "LW-00042",
  "data": [
    {
      "time": "2026-02-27T03:00:00Z",
      "lux": "123.4",
      "temperature_c": "22",
      "humidity_pct": "48",
      "light_level_pct": "80"
    }
  ]
}
```

**Response `400`**
```json
{ "error": "from and to are required" }
{ "error": "from must be before to" }
{ "error": "interval must be one of {'1m', '5m', '15m', '1h', '1d'}" }
```

---

### `PUT /streetlights/{id}/metadata`

Updates the display name and/or coordinates of a streetlight.

**Path Parameters**

| Parameter | Type | Description |
| --- | --- | --- |
| `id` | string | Streetlight identifier |

**Request Body**

At least one field is required.

```json
{
  "name": "Main Street 5th Ave",
  "lat": 37.7749,
  "lng": -122.4194
}
```

**Response `200`**
```json
{ "message": "updated" }
```

**Response `400`**
```json
{ "error": "At least one of name, lat, lng is required" }
```

---

## WebSocket API

**Route selection:** API Gateway routes on the `action` field in the message body.

---

### `$connect`

Establishes a WebSocket connection. Stores the connection in DynamoDB.

**Query Parameters**

| Parameter | Type | Required | Description |
| --- | --- | --- | --- |
| `tenant_id` | string | yes (demo) | Tenant identifier. Will be replaced by Cognito token in production. |

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

`HTTP 200` with body `"subscribed"` on success.

| Status | Meaning |
| --- | --- |
| `200` | Subscribed successfully |
| `400` | `streetlight_id` missing |
| `401` | Auth failed |
| `500` | Unexpected error |

---

### Server Push — Telemetry Event

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

---

## Error Responses

All endpoints return errors in the following format:

```json
{ "error": "Description of the error" }
```

| Status | Meaning |
| --- | --- |
| `400` | Bad request — missing or invalid parameters |
| `401` | Unauthorized — auth failed |
| `404` | Resource not found |
| `500` | Internal server error |

---

**Document Version:** 1.0  
**Last Updated:** February 27, 2026