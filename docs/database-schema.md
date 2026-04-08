# Database Schema Design

This document describes the database schema used by LightWise, including how streetlight metadata, authorization data, real-time telemetry, and downlink commands are stored and accessed.

LightWise deliberately separates operational state from time-series telemetry. Device metadata and access control require strong consistency and low-latency point lookups, while sensor telemetry requires high-throughput ingestion and efficient time-based queries. Each data store is selected and shaped to match these access patterns.

## Data Storage Overview

| Data Type                          | Service                          | Rationale                                           |
| ---------------------------------- | -------------------------------- | --------------------------------------------------- |
| Streetlight operational state      | DynamoDB (Streetlights)          | Fast key-value access, low cost; frequently updated |
| Streetlight metadata (UI)          | DynamoDB (StreetlightMetadata)   | Static info for frontend (coordinates, labels)      |
| User ↔ tenant mapping, roles       | DynamoDB (UsersAndTenants)       | Authorization, multi-tenant isolation               |
| Active WebSocket connections       | DynamoDB (WebSocketConnections)  | Real-time fanout to connected clients               |
| Downlink command lifecycle         | DynamoDB (DownlinkCommands)      | Command audit trail, ACK/NACK correlation           |
| Real-time telemetry                | InfluxDB                         | High-throughput time-series ingestion               |
| Historical analytics               | Influxdb                         | Windowed queries, aggregation                       |

---

## DynamoDB

DynamoDB serves as the system of record for all non-time-series data.
It stores current streetlight state, metadata, authorization relationships, WebSocket connections, and downlink command history.

---

### Streetlights

#### Purpose
Stores the authoritative, latest-known state of each deployed streetlight.
This table answers operational questions such as:
- Is the streetlight healthy?
- When was it last seen?
- What firmware is it running?

Historical values are intentionally not stored here.

#### Primary Key
```
PK: tenant_id
SK: streetlight_id
```

#### GSI: ByStreetlightId
```
PK: streetlight_id
```
Used to resolve `tenant_id` from a `streetlight_id` alone, e.g. during raw uplink processing where only the `wireless_device_id` is known.

#### Example Item
```json
{
  "tenant_id": "tenant-001",
  "streetlight_id": "LW-00100",
  "firmware_version": "1.0",
  "last_seen": "2026-02-16T03:41:12Z",
  "health_status": "DEGRADED",
  "motion_detected": true,
  "ambient_health": "DEGRADED",
  "mmwave_health": "SYSTEM_OK",
  "th_ok": true,
  "light_ok": true,
  "overall_ok": false,
  "rssi": -92,
  "snr": 7,
  "provisioned_at": "2026-02-01T18:22:00Z"
}
```

#### Health Field Notes

| Field | Type | Values | Description |
| --- | --- | --- | --- |
| `health_status` | string | `OK`, `DEGRADED`, `CRITICAL` | Derived operational status written by the telemetry pipeline |
| `ambient_health` | string | `TOTAL_FAILURE`, `PRIMARY_FAIL`, `SECONDARY_FAIL`, `DEGRADED`, `SYSTEM_OK` | 3-bit sensor health from uplink spec v1.3 |
| `mmwave_health` | string | same as above | mmWave sensor health |
| `th_ok` | bool | — | TH sensor healthy |
| `light_ok` | bool | — | AC bulb drawing expected current (current sensing) |
| `overall_ok` | bool | — | Hardware-level signal; `false` drives `CRITICAL` regardless of individual sensor state |

#### Access Patterns
- Fetch latest state per streetlight
- Update `last_seen`, `health_status`, sensor health, and RF metrics on each uplink
- Render fleet and site-level dashboards
- Detect offline or unhealthy streetlights

---

### StreetlightMetadata

#### Purpose
Stores static info used by the UI, such as coordinates, site info, model, and installation metadata.
This avoids writing static data on every telemetry uplink.

#### Primary Key
```
PK: streetlight_id
SK: METADATA
```

#### GSI: ByWirelessDeviceId
```
PK: wireless_device_id
```
Used during uplink processing to resolve `streetlight_id`, `tenant_id`, and `site_id` from the network-server-provided `WirelessDeviceId`.

#### Example Item
```json
{
  "streetlight_id": "LW-00001",
  "wireless_device_id": "559bf27a-76d7-4afe-a12c-0c618afe0eeb",
  "lat": 37.7749,
  "lng": -122.4194,
  "site_id": "CITY#SF",
  "model": "LW-2025",
  "installed_at": "2026-01-20T10:30:00Z",
  "label": "Main Street 5th Ave"
}
```

#### Access Patterns
- Display map with streetlight positions
- Show static info in frontend dashboard
- Query by `streetlight_id` for detail view
- Resolve device identity from `wireless_device_id` during uplink processing
- Join with Streetlights table for combined UI view

---

### UsersAndTenants

#### Purpose
Single table that stores tenant definitions, user identities, and user ↔ tenant membership in one place. Uses item type to differentiate records. This consolidates what would otherwise be three separate tables (TenantsTable, UsersTable, TenantUsersMapping) without sacrificing any access patterns needed at MVP.

#### Primary Key
```
PK: tenant_id
SK: user_id  (or "TENANT" for tenant-level records)
```

#### Example Items

Tenant record (`SK = "TENANT"`)
```json
{
  "tenant_id": "tenant-001",
  "SK": "TENANT",
  "name": "Little Saint James",
  "created_at": "2026-01-01T00:00:00Z"
}
```

User membership record (`SK = user_id`)
```json
{
  "tenant_id": "tenant-001",
  "user_id": "u-123",
  "email": "ops@city.gov",
  "role": "ADMIN",
  "created_at": "2026-01-10T14:05:00Z"
}
```

#### Access Patterns
- Resolve tenant context and configuration
- Check if a user belongs to a tenant
- Enforce role-based permissions
- List all users within a tenant
- User profile and identity lookup

---

### WebSocketConnections

#### Purpose
Tracks active WebSocket connections established via API Gateway. Used to fan out real-time telemetry to connected clients. Records are written on `$connect` and deleted on `$disconnect`.

#### Primary Key
```
PK: connection_id
```

#### GSI: ByTenant
```
PK: tenant_id
```

#### Example Item
```json
{
  "connection_id": "abc123==",
  "tenant_id": "tenant-001",
  "user_id": "u-123",
  "connected_at": "2026-02-24T10:00:00Z",
  "streetlight_ids": ["LW-00100"]
}
```

#### Access Patterns
- Write connection record on `$connect`
- Delete connection record on `$disconnect`
- Query by `tenant_id` (via GSI) to find all active connections for fanout
- Clean up stale connections when a push returns `GoneException`

---

### DownlinkCommands

#### Purpose
Tracks the full lifecycle of every command issued to a streetlight. Serves as both the authoritative audit trail and the mechanism for correlating ACK/NACK responses received on subsequent uplinks.

LightWise uses **LoRaWAN Class C** devices, which listen continuously. Commands are dispatched immediately by the Lambda handling the request — there is no separate dispatcher or queue. The device ACKs or NACKs on its next uplink, at which point the uplink Lambda updates the command status.

#### Primary Key
```
PK: streetlight_id
SK: command_id  (ULID — time-ordered, collision-free)
```

#### GSI: ByTenant
```
PK: tenant_id
SK: command_id
```
Used to list all commands issued within a tenant across all streetlights.

#### Example Item
```json
{
  "streetlight_id": "LW-00100",
  "command_id": "01HX9Z2K4FVTQW3MJNP8XBCD5",
  "tenant_id": "tenant-001",
  "issued_by": "u-123",
  "command_type": "SET_LIGHT_LEVEL",
  "payload": { "light_level_pct": 80 },
  "status": "PENDING",
  "created_at": "2026-03-31T10:00:00Z",
  "sent_at": null,
  "acknowledged_at": null,
  "ttl": 1743600000
}
```

#### Status Lifecycle
```
PENDING → SENT → ACKNOWLEDGED
                → FAILED
                → TIMED_OUT  (via TTL expiry)
```

| Status | Meaning |
| --- | --- |
| `PENDING` | Command written; Lambda is about to dispatch to the network server |
| `SENT` | Network server accepted the downlink; awaiting device ACK/NACK |
| `ACKNOWLEDGED` | Device confirmed receipt on uplink |
| `FAILED` | Device returned NACK, or Lambda failed to reach the network server |
| `TIMED_OUT` | TTL expired; device never responded (e.g. offline at time of command) |

#### Notes
- TTL is set at write time to guard against stale `PENDING` items if the Lambda fails after dispatching but before writing `SENT`
- No separate queue table is needed — Class C devices are always listening, so the Lambda dispatches synchronously on command receipt
- ACK/NACK correlation uses `echo_cmd` from the uplink payload matched against the `command_type` for the streetlight's most recent `SENT` record

#### Access Patterns
- Write command record on issuance
- Update status to `SENT` after successful network server call
- Update status to `ACKNOWLEDGED` or `FAILED` on uplink ACK/NACK
- Query by `streetlight_id` for per-device command history
- Query by `tenant_id` (via GSI) for fleet-wide audit log
- Detect stale commands via TTL expiry

---

## Timestream/InfluxDB

Used exclusively for append-only telemetry data emitted by streetlights.
It is not a source of truth for current streetlight state.

**Why:**
- Designed for high-ingestion IoT workloads
- Native support for time-windowed queries
- Automatic tiered storage for cost control

---

### StreetlightMetrics

#### Purpose
Stores real-time and historical raw sensor telemetry emitted by LightWise streetlights.

This table reflects what the streetlight reports — not inferred state or health.

#### Dimensions
Low-cardinality attributes used for filtering and grouping:

| Dimension        | Description                   |
| ---------------- | ----------------------------- |
| `streetlight_id` | Unique streetlight identifier |
| `site_id`        | Deployment location or city   |

**Why dimensions:**
- Used for query filtering
- Stable over time
- Low cardinality to prevent index bloat

#### Measures
All values are written as a single multi-measure record per uplink.

| Measure           | Type   | Units | Source Payload | Description                              |
| ----------------- | ------ | ----- | -------------- | ---------------------------------------- |
| `lux`             | DOUBLE | lux   | `lux_x10`      | Ambient light level (`lux_x10 / 10.0`)   |
| `temperature_c`   | BIGINT | °C    | `tempC`        | Temperature in Celsius (signed)          |
| `humidity_pct`    | BIGINT | %     | `humidity`     | Relative humidity (0–100)                |
| `flags1`          | BIGINT | –     | `flags1`       | Sensor health + motion (see Uplink spec) |
| `flags2`          | BIGINT | –     | `flags2`       | TH health + light ok (see Uplink spec)   |
| `light_level_pct` | BIGINT | %     | `lightLevel`   | Light output level (0–100)               |
| `rssi`            | BIGINT | dBm   | uplink meta    | Received signal strength                 |
| `snr`             | BIGINT | dB    | uplink meta    | Signal-to-noise ratio                    |

**Why this mapping:**
- Scaled values are normalised once at ingest to simplify queries
- `flags1` and `flags2` are stored raw to allow future reinterpretation without reingest — the uplink spec v1.3 split the original single `flags` byte into two
- No health or derived fields (those belong in DynamoDB)
- `BIGINT` types are used where precision is fixed and known

#### Example Record
```json
{
  "Dimensions": [
    { "Name": "streetlight_id", "Value": "LW-00100" },
    { "Name": "site_id",        "Value": "CITY#SF"  }
  ],
  "MeasureName": "telemetry",
  "MeasureValues": [
    { "Name": "lux",             "Value": "134.2", "Type": "DOUBLE" },
    { "Name": "temperature_c",   "Value": "22",    "Type": "BIGINT" },
    { "Name": "humidity_pct",    "Value": "48",    "Type": "BIGINT" },
    { "Name": "flags1",          "Value": "164",   "Type": "BIGINT" },
    { "Name": "flags2",          "Value": "3",     "Type": "BIGINT" },
    { "Name": "light_level_pct", "Value": "80",    "Type": "BIGINT" },
    { "Name": "rssi",            "Value": "-92",   "Type": "BIGINT" },
    { "Name": "snr",             "Value": "7",     "Type": "BIGINT" }
  ],
  "Time": "2026-02-16T03:41:12Z"
}
```

#### Retention Policy

| Storage Tier   | Retention |
| -------------- | --------- |
| Memory Store   | 7 days    |
| Magnetic Store | 90 days   |

**Why this policy:**
- Recent data is queried frequently for dashboards and alerts
- Older data is used for trend analysis and degradation tracking
- Balances cost with analytical needs

#### Access Patterns
- Fetch latest telemetry per streetlight
- Render time-series charts
- Aggregate metrics by site or fleet
- Analyse sensor degradation and RF performance over time

---

## Architectural Rationale

LightWise enforces a strict separation of concerns:
- DynamoDB stores current truth, authorization data, connection state, and command lifecycle (5 tables)
- Timestream stores historical truth and analytical telemetry

This design:
- Scales linearly with streetlight count
- Avoids hot partitions
- Prevents analytical queries from impacting operational state
- Aligns data shape with access patterns
- Keeps derived health state in DynamoDB and raw wire data in Timestream — each store reflects only what it owns

---

**Document Version**: 1.4
**Last Updated**: April 1, 2026
