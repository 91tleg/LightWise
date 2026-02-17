# Database Schema Design

This document describes the database schema used by LightWise, including how device metadata, authorization data, and real-time telemetry are stored and accessed.

LightWise deliberately separates operational state from time-series telemetry. Device metadata and access control require strong consistency and low-latency point lookups, while sensor telemetry requires high-throughput ingestion and efficient time-based queries. Each data store is selected and shaped to match these access patterns.

## Data Storage Overview

| Data Type               | Service           | Rationale                             |
| ----------------------- | ----------------- | ------------------------------------- |
| Device identity & state | DynamoDB          | Fast key-value access, low cost       |
| User ↔ device mapping   | DynamoDB          | Authorization, multi-tenant isolation |
| Real-time telemetry     | Amazon Timestream | High-throughput time-series ingestion |
| Historical analytics    | Amazon Timestream | Windowed queries, aggregation         |


---

## DynamoDB

DynamoDB serves as the system of record for all non-time-series data.
It stores current device state, metadata, and authorization relationships that must be read and updated frequently.

--- 

### DevicesTable

#### Purpose:
Stores the authoritative, latest-known state of each deployed device.  
This table answers operational questions such as:  
- Is the device healthy?
- When was it last seen?
- What firmware is it running?  

Historical values are intentionally not stored here.

#### Primary Key
```text
PK: DEVICE#<deviceId>  
SK: METADATA
```
Why this format
- Ensures a single, strongly consistent item per device
- Optimized for direct lookups by deviceId
- Leaves room for future expansion (e.g., additional SKs for config or logs)

#### Example item
```json
{
  "PK": "DEVICE#LW-00042",
  "SK": "METADATA",
  "deviceId": "LW-00042",
  "siteId": "CITY#SF",
  "firmwareVersion": "1.0",
  "lastSeen": "2026-02-16T03:41:12Z",
  "health": "DEGRADED",
  "ambientHealth": "DEGRADED",
  "rssi": -92,
  "snr": 7,
  "provisionedAt": "2026-02-01T18:22:00Z"
}
```

#### Access patterns
- Get device state by `deviceId`
- Update lastSeen, health, and RF metrics on each uplink
- Render fleet and site-level dashboards
- Detect offline or unhealthy devices

---

### UsersTable

#### Purpose:
Defines ownership, permissions, and multi-tenant boundaries between users and devices.  
This table enables authorization checks without scanning device data.

#### Primary Key 
```text
PK: USER#<userId>
SK: DEVICE#<deviceId>
```
Why this format
- Efficiently lists all devices a user can access
- Supports role-based access per device
- Avoids joins or secondary indexes for authorization checks

#### Example user item
```json
{
  "PK": "USER#u-123",
  "SK": "DEVICE#LW-00042",
  "email": "ops@city.gov",
  "role": "ADMIN",
  "createdAt": "2026-01-10T14:00:00Z"
}
```
#### Access Patterns
- List all devices accessible by a user
- Enforce role-based permissions
- Support future sharing or delegation models

---

## Timestream
Timestream is used exclusively for append-only telemetry data emitted by devices.  
It is not a source of truth for current device state.  

Why Timestream
- Designed for high-ingestion IoT workloads
- Native support for time-windowed queries
- Automatic tiered storage for cost control

---

### DeviceMetrics

#### Purpose
Stores real-time and historical raw sensor telemetry emitted by LightWise devices.

This table reflects what the device reports, not inferred state or health.

#### Dimensions
Low-cardinality attributes used for filtering and grouping:

| Dimension   | Description                   |
| ----------- | ----------------------------- |
| `device_id` | Unique streetlight identifier |
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
| `light_level_pct` | BIGINT | %     | `lightLevel`   | User-configured light output (0–100)   |
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
    { "Name": "device_id", "Value": "LW-00042" },
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
- Fetch latest telemetry per device
- Render time-series charts
- Aggregate metrics by site or fleet
- Analyze sensor degradation and RF performance

---

## Architectural Rationale
LightWise enforces a strict separation of concerns:
- DynamoDB stores current truth and authorization data
- Timestream stores historical truth and analytical telemetry

This design:
- Scales linearly with device count
- Avoids hot partitions
- Prevents analytical queries from impacting operational state
- Aligns data shape with access patterns

---

**Document Version**: 1.0   
**Last Updated**: February 16, 2026  
