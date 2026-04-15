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
  "data": [
    {
      "time": "2026-02-27T03:00:00Z",
      "lux": 123.4,
      "temperature_c": 22.0,
      "humidity_pct": 48.0,
      "light_level_pct": 80.0
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
