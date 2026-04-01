# HTTP API
**Version:** 1.0  
**Last Updated:** March 13, 2026  

See [README.md](./README.md) for shared conventions.

---

## Endpoints

### `GET /streetlights`

Returns all streetlights for a tenant. Used to render the map with pins and health indicators.

**Query Parameters**
| Parameter | Type | Required | Description |
|---|---|---|---|
| `tenant_id` | string | demo only | Tenant identifier — replaced by Cognito claims in production |

**Response `200`**
```json
[
  {
    "streetlight_id": "LW-00100",
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

---

### `GET /streetlights/{id}`

Returns full detail for a single streetlight. Used when a user clicks a map pin.

**Path Parameters**
| Parameter | Type | Description |
|---|---|---|
| `id` | string | Streetlight identifier |

**Query Parameters**
| Parameter | Type | Required | Description |
|---|---|---|---|
| `tenant_id` | string | demo only | Tenant identifier — replaced by Cognito claims in production |

**Response `200`**
```json
{
  "streetlight_id": "LW-00100",
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
|---|---|---|
| `id` | string | Streetlight identifier |

**Query Parameters**
| Parameter | Type | Required | Description |
|---|---|---|---|
| `from` | ISO 8601 | yes | Start of time range |
| `to` | ISO 8601 | yes | End of time range |
| `interval` | string | no | Aggregation interval. Default `5m`. One of `1m`, `5m`, `15m`, `1h`, `1d` |

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
{ "error": "interval must be one of {'1m', '5m', '15m', '1h', '1d'}" }
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
```

