# HTTP API
**Version:** 1.1  
**Last Updated:** April 9, 2026  
See [README.md](./README.md) for shared conventions.

---

## Endpoints

### `GET /streetlights`

Returns all streetlights for a tenant. Used to render the map with pins and health indicators.

**Response `200`**
```json
[
  {
    "streetlight_id": "LW-00100",
    "name": "Main Street 5th Ave",
    "site_id": "north-parking-lot",
    "health": "DEGRADED",
    "last_seen": "2026-02-27T03:41:12Z",
    "location": {
      "lat": 37.7749,
      "lng": -122.4194
    }
  }
]
```

---

### `GET /streetlights/{id}`

Returns full detail for a single streetlight. Used when a user clicks a map pin.

**Path Parameters**

| Parameter | Type | Description |
|---|---|---|
| `id` | string | Streetlight identifier |

**Response `200`**
```json
{
  "streetlight_id": "LW-00100",
  "tenant_id": "tenant-001",
  "health": "DEGRADED",
  "last_seen": "2026-02-27T03:41:12Z",
  "motion_detected": true,
  "rssi": -65,
  "snr": 8.0,
  "diagnostics": {
    "overall_ok": false,
    "ambient_health": "DEGRADED",
    "mmwave_health": "SYSTEM_OK",
    "th_ok": true,
    "light_ok": true
  },
  "lat": 37.7749,
  "lng": -122.4194,
  "name": "Main Street 5th Ave",
  "site_id": "north-parking-lot",
  "model": "LUM-MAX-200",
  "installed_at": "2025-10-15T10:00:00Z"
}
```

**Response `404`**
```json
{ "error": "Streetlight not found" }
```

---

### `GET /streetlights/{id}/telemetry`

Returns time-series sensor data for charts. Hits the configured telemetry backend
(InfluxDB or Timestream). Returns empty array when no backend is configured (local/demo).

**Path Parameters**

| Parameter | Type | Description |
|---|---|---|
| `id` | string | Streetlight identifier |

**Query Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `from` | ISO 8601 | yes | Start of time range |
| `to` | ISO 8601 | yes | End of time range |
| `interval` | string | no | Aggregation interval. Default `5m`. See allowed values below. |

**Allowed intervals**

| Interval | Use case |
|---|---|
| `1m`, `5m`, `10m`, `15m`, `30m` | Short-term (last few hours) |
| `1h`, `6h`, `12h` | Medium-term (last few days) |
| `1d`, `7d`, `30d` | Energy trend analysis |

Note: the server enforces a minimum interval based on the query window. Requesting
`1m` over a 30-day window will be silently coerced to `1d`. The response reflects
the resolved interval.

**Response `200`**
```json
{
  "streetlight_id": "LW-00100",
  "motion_total": 42,
  "data": [
    {
      "time": "2026-02-27T03:00:00Z",
      "lux": 123.4,
      "temperature_c": 22.0,
      "humidity_pct": 48.0,
      "light_level_pct": 80.0,
      "motion": 3,
      "motion_count": 3,
      "motion_samples": 12
    }
  ]
}
```

**Response `400`**
```json
{ "error": "from and to are required" }
{ "error": "from must be before to" }
{ "error": "interval must be one of {'1d', '10m', '12h', '15m', '1h', '1m', '30d', '30m', '5m', '6h', '7d'}" }
```

---

### `PUT /streetlights/{id}/metadata`

Updates the display name and/or coordinates of a streetlight.

**Path Parameters**

| Parameter | Type | Description |
|---|---|---|
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
{ "error": "Streetlight not found" }
{ "error": "Invalid latitude: 91.0" }
```

**Response `404`**
```json
{ "error": "Streetlight not found" }
```

---

### `GET /streetlights/{id}/commands`

Returns recent downlink command records for a streetlight. Used by the admin
console to show whether commands are pending, acknowledged, rejected, or timed
out.

**Path Parameters**

| Parameter | Type | Description |
|---|---|---|
| `id` | string | Streetlight identifier |

**Query Parameters**

| Parameter | Type | Required | Description |
|---|---|---|---|
| `limit` | integer | no | Maximum number of commands to return |

**Response `200`**
```json
{
  "streetlight_id": "LW-00100",
  "commands": [
    {
      "command_id": "cmd-20260509-001",
      "streetlight_id": "LW-00100",
      "command": "SET_LEVELS",
      "params": {
        "max_level": 90,
        "dim_level": 20
      },
      "status": "ACKNOWLEDGED",
      "dispatched_at": "2026-05-09T18:22:14.000Z",
      "response": {
        "received_at": "2026-05-09T18:22:17.000Z",
        "response_code": "ACK",
        "reason_code": ""
      }
    }
  ]
}
```

---

### `POST /streetlights/{id}/commands`

Queues a downlink command for a streetlight. The command is encoded for the
LoRaWAN device and recorded so the admin console can display command history
and acknowledgement status.

**Path Parameters**

| Parameter | Type | Description |
|---|---|---|
| `id` | string | Streetlight identifier |

**Request Body**

```json
{
  "command": "SET_LEVELS",
  "params": {
    "max_level": 90,
    "dim_level": 20
  }
}
```

**Supported commands**

| Command | Parameters |
|---|---|
| `REQUEST_UPLINK` | none |
| `OVERRIDE_ON` | `level` |
| `OVERRIDE_OFF` | none |
| `RESUME_AUTO` | none |
| `SET_LEVELS` | `max_level`, `dim_level` |
| `SET_MOTION_TIMEOUT` | `timeout_seconds` |
| `SET_TEMP_DIM` | `level`, `duration_hours` |
| `SET_MOTION_SENSITIVITY` | `sensitivity` |
| `SET_HEARTBEAT_INTERVAL` | `interval_minutes` |
| `REBOOT` | none |

**Response `202`**
```json
{
  "command_id": "cmd-20260509-001",
  "streetlight_id": "LW-00100",
  "command": "SET_LEVELS",
  "status": "PENDING",
  "dispatched_at": "2026-05-09T18:22:14.000Z"
}
```

**Response `400`**
```json
{ "error": "command is required" }
{ "error": "Unsupported command" }
```

**Response `404`**
```json
{ "error": "Streetlight not found" }
```

---

## `POST /invite-user`

Invites a new user to the tenant and creates their Cognito account.

Only the tenant owner can invite users.

### Authentication

Requires a valid Cognito access token.

### Request Body

```json
{
  "email": "operator@city.gov",
  "role": "operator"
}
```

### Fields

| Field   | Type   | Required | Description                              |
| ------- | ------ | -------- | ---------------------------------------- |
| `email` | string | Yes      | Email address of the invited user        |
| `role`  | string | Yes      | User role. Must be `admin` or `operator` |

**Response `201`**

```json
{
  "user_id": "3f5a9c7d-8e11-4a1f-bb2d-4d0d3c7a5e91",
  "email": "operator@city.gov",
  "role": "operator",
  "tenant_id": "tenant-123",
  "created_at": "2026-05-07T18:22:14.000Z"
}
```

**Response `403`**

Returned when the requesting user is not the tenant owner.

```json
{
  "message": "Only tenant owner can invite users"
}
```

**Response `409`**

Returned when the Cognito user already exists or Cognito rejects the request.

```json
{
  "message": "User already exists"
}
```

---

## `GET /users`

Returns all users belonging to the authenticated user's tenant.

Any authenticated user in the tenant can list users.

### Authentication

Requires a valid Cognito access token.

**Response `200`**

```json
[
  {
    "user_id": "3f5a9c7d-8e11-4a1f-bb2d-4d0d3c7a5e91",
    "email": "owner@city.gov",
    "role": "admin",
    "tenant_id": "tenant-123",
    "created_at": "2026-05-01T10:15:42.000Z"
  },
  {
    "user_id": "7b1c92a4-4c8b-42f6-a6f8-87d9b9cf5c10",
    "email": "operator@city.gov",
    "role": "operator",
    "tenant_id": "tenant-123",
    "created_at": "2026-05-07T18:22:14.000Z"
  }
]
```

---

## `DELETE /users/{id}`

Removes a user from the tenant and deletes their Cognito account.

Only the tenant owner can remove users.

### Authentication

Requires a valid Cognito access token.

### Path Parameters

| Parameter | Type   | Required | Description                   |
| --------- | ------ | -------- | ----------------------------- |
| `id`      | string | Yes      | User ID of the user to remove |

**Response `200`**

```json
{
  "message": "User removed"
}
```

**Response `403`**

Returned when the requesting user is not the tenant owner.

```json
{
  "message": "Only tenant owner can remove users"
}
```

**Response `409`**

Returned when Cognito rejects the delete request.

```json
{
  "message": "User does not exist"
}
```

---

## `PATCH /users/{id}`

Updates a user's name inside the tenant.

Only the tenant owner can update user data.

### Authentication

Requires a valid Cognito access token.

### Path Parameters

| Parameter | Type   | Required | Description                   |
| --------- | ------ | -------- | ----------------------------- |
| `id`      | string | Yes      | User ID of the user to update |

### Request Body

```json
{
  "name": "Jimmy Johns"
}
