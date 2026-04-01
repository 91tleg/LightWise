# Database Schema Design

This document describes the database schema used by LightWise, including how streetlight metadata, authorization data, and real-time telemetry are stored and accessed.

LightWise deliberately separates operational state from time-series telemetry. Device metadata and access control require strong consistency and low-latency point lookups, while sensor telemetry requires high-throughput ingestion and efficient time-based queries. Each data store is selected and shaped to match these access patterns.

## Data Storage Overview

| Data Type                | Service                                    | Rationale                                           |
| ------------------------ | ------------------------------------------ | --------------------------------------------------- |
| Streetlight operational state | DynamoDB (Streetlights)                    | Fast key-value access, low cost; frequently updated |
| Streetlight metadata (UI)     | DynamoDB (StreetlightMetadata)             | Static info for frontend (coordinates, labels)      |
| User ↔ tenant mapping, roles    | DynamoDB (UsersAndTenants) | Authorization, multi-tenant isolation               |
| Real-time telemetry      | Amazon Timestream                          | High-throughput time-series ingestion               |
| Historical analytics     | Amazon Timestream                          | Windowed queries, aggregation                       |

---

## DynamoDB

DynamoDB serves as the system of record for all non-time-series data.
It stores current streetlight state, metadata, and authorization relationships that must be read and updated frequently.

--- 

### Streetlights

#### Purpose:
Stores the authoritative, latest-known state of each deployed streetlight.  
This table answers operational questions such as:  
- Is the streetlight healthy?
- When was it last seen?
- What firmware is it running?  

Historical values are intentionally not stored here.

#### Primary Key
```text
PK: tenant_id
SK: streetlight_id
```

#### GSI: ByStreetlightId
```
PK: streetlight_id
```
Used to resolve `tenant_id` from a `streetlight_id` alone, e.g. during raw uplink processing where only the `dev_eui` is known.

#### Example item
```json
{
  "tenant_id": "tenant-001",
  "streetlight_id": "LW-00100",
  "firmware_version": "1.0",
  "last_seen": "2026-02-16T03:41:12Z",
  "health_status": "DEGRADED",
  "motion_detected": true,
  "ambient_primary_ok": true,
  "ambient_secondary_ok": false,
  "th_ok": true,
  "motion_primary_ok": true,
  "motion_secondary_ok": true,
  "rssi": -92,
  "snr": 7,
  "provisioned_at": "2026-02-01T18:22:00Z"
}
```

#### Access patterns
- Fetch latest state per streetlight
- Update lastSeen, health, and RF metrics on each uplink
- Render fleet and site-level dashboards
- Detect offline or unhealthy streetlight

---

### StreetlightMetadata

#### Purpose:
Stores static info used by the UI, such as coordinates, site info, model, and installation metadata.  
This avoids writing static data on every telemetry uplink.

#### Primary Key
```text
PK: streetlight_id
SK: METADATA
```

#### GSI
```text
PK: wireless_device_id
```

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
Access Patterns
- Display map with streetlight positions
- Show static info in frontend dashboard
- Query by streetlight_id for detail view
- Join with Streetlights table for combined UI view

---

### UsersAndTenants

#### Purpose:
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

### WebSocketConnections

#### Purpose:
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
- Write connection on `$connect`
- Delete connection on `$disconnect`
- Query by tenant_id (via GSI) to find all active connections for fanout
- Clean up stale connections when a push returns GoneException

---

## Timestream
Timestream is used exclusively for append-only telemetry data emitted by streetlights.  
It is not a source of truth for current streetlight state.  

Why Timestream
- Designed for high-ingestion IoT workloads
- Native support for time-windowed queries
- Automatic tiered storage for cost control

---

### StreetlightMetrics

#### Purpose
Stores real-time and historical raw sensor telemetry emitted by LightWise streetlights.

This table reflects what the streetlight reports, not inferred state or health.

#### Dimensions
Low-cardinality attributes used for filtering and grouping:

| Dimension   | Description                   |
| ----------- | ----------------------------- |
| `streetlight_id` | Unique streetlight identifier |
| `site_id`   | Deployment location or city   |

Why dimensions
- Used for query filtering
- Stable over time
- Low cardinality to prevent index bloat

#### Measures
All values are written as a single multi-measure record per uplink.

| Measure           | Type   | Units | Source Payload | Description                            |
| ----------------- | ------ | ----- | -------------- | -------------------------------------- |
| `lux`             | DOUBLE | lux   | `lux_x10`      | Ambient light level (`lux_x10 / 10.0`) |
| `temperature_c`   | BIGINT | °C    | `tempC`        | Temperature in Celsius                 |
| `humidity_pct`    | BIGINT | %     | `humidity`     | Relative humidity (0–100)              |
| `flags`           | BIGINT | –     | `flags`        | Bitfield (motion + status flags)       |
| `light_level_pct` | BIGINT | %     | `lightLevel`   | light output level(0–100)   |
| `rssi`            | BIGINT | dBm   | uplink meta    | Received signal strength               |
| `snr`             | BIGINT | dB    | uplink meta    | Signal-to-noise ratio                  |


Why This Mapping
- Scaled values are normalized once to simplify queries
- Flags are stored raw to allow future reinterpretation without reingest
- No health or derived fields (those belong in DynamoDB)
- INTEGER types are used where precision is fixed and known

#### Example Record
```json
{
  "Dimensions": [
    { "Name": "streetlight_id", "Value": "LW-00100" },
    { "Name": "site_id", "Value": "CITY#SF" }
  ],
  "MeasureName": "telemetry",
  "MeasureValues": [
    { "Name": "lux", "Value": "134.2", "Type": "DOUBLE" },
    { "Name": "temperature_c", "Value": "22", "Type": "BIGINT" },
    { "Name": "humidity_pct", "Value": "48", "Type": "BIGINT" },
    { "Name": "flags", "Value": "5", "Type": "BIGINT" },
    { "Name": "light_level_pct", "Value": "80", "Type": "BIGINT" },
    { "Name": "rssi", "Value": "-92", "Type": "BIGINT" },
    { "Name": "snr", "Value": "7", "Type": "BIGINT" }
  ],
  "Time": "2026-02-16T03:41:12Z"
}

```

#### Retention Policy
| Storage Tier   | Retention |
| -------------- | --------- |
| Memory Store   | 7 days    |
| Magnetic Store | 90 days   |

Why this policy  
- Recent data is queried frequently
- Older data is used for trend analysis
- Balances cost with analytical needs

#### Access Patterns
- Fetch latest telemetry per streetlight
- Render time-series charts
- Aggregate metrics by site or fleet
- Analyze sensor degradation and RF performance

---

## Architectural Rationale
LightWise enforces a strict separation of concerns:
- DynamoDB stores current truth and authorization data (3 tables)
- Timestream stores historical truth and analytical telemetry

This design:
- Scales linearly with streetlight count
- Avoids hot partitions
- Prevents analytical queries from impacting operational state
- Aligns data shape with access patterns

---

**Document Version**: 1.2   
**Last Updated**: March 5, 2026  

