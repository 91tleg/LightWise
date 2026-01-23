
# LightWise API Contract v0.1
Version: 0.1

## Goal
Enable smart streetlight telemetry collection from ESP32 via LoRaWAN, process through AWS, and display real-time data on React dashboard.

---

## System Architecture

```
ESP32 (LoRaWAN)
  ↓ LoRaWAN Protocol
Gateway (LoRaWAN)
  ↓ MQTT over TLS
AWS IoT Core (MQTT Broker)
  ├→ Lambda (Real-time Processing & Storage)
  │   ↓
  │   DynamoDB (Time-series Data)
  │
  ├→ API Gateway (REST - Data Retrieval)
  │   ↓
  │   React Dashboard (WebSocket + REST)
```

## Key Endpoints Overview
- **Ingest**: `POST /telemetry` — Lambda receives data from gateway
- **Retrieval**: `GET /telemetry` — React dashboard fetches historical data
- **Live Updates**: WebSocket via API Gateway — Real-time data streaming

---

## AWS IoT Core Configuration

### MQTT Topics
Gateway publishes telemetry data to AWS IoT Core using MQTT:

**Topic**: `lightwise/telemetry/{poleId}`

**Payload**: (JSON)
```json
{
  "poleId": "LW-001",
  "timestamp": "2026-01-22T21:15:00Z",
  "ambientLux": 12.5,
  "motion": true,
  "tempC": 18.4,
  "humidity": 62.0,
  "rssi": -67
}
```

**Connection Requirements**:
- Protocol: MQTT 3.1.1 over TLS 1.2+
- Host: `<account-id>-ats.iot.<region>.amazonaws.com`
- Port: 8883 (MQTT over TLS)
- Client Certificate: Device certificate (x.509)
- Keep-alive: 60 seconds

### IoT Rule (Topic-to-Lambda Integration)
AWS IoT Rule Engine forwards MQTT messages to Lambda:
- **Rule Name**: `LightWiseTelemetryRule`
- **Topic filter**: `lightwise/telemetry/#`
- **Action**: Invoke Lambda function

---

## Base URL (REST API)
Provided by API Gateway after deployment:
```
https://<api-id>.execute-api.<region>.amazonaws.com
```

Example:
```
https://abc123def.execute-api.us-east-1.amazonaws.com
```

## Authentication
Authentication is handled using a shared secret header.

Header:
- X-API-Key: <shared_secret>

Example (dev):
- X-API-Key: devkey123

If missing/invalid --> 401 Unauthorized.

Note: HTTP API usage plans are not used in v0.1. Validation is handled directly inside Lambda.

---

## Endpoint 1: Telemetry Ingest

### POST /telemetry
Ingests one telemetry sample from a single streetlight pole.

#### Request Headers
- Content-Type: application/json
- X-API-Key: Authentication key

#### Request Body (JSON)
All fields required unless marked optional:

```json
{
  "poleId": "LW-001",
  "timestamp": "2026-01-22T21:15:00Z",
  "ambientLux": 12.5,
  "motion": true,
  "tempC": 18.4,
  "humidity": 62.0,
  "rssi": -67
}
````

#### Field Rules

* poleId (string, required): 1..64 chars, allowed [A-Za-z0-9_-]
* timestamp (string, required): ISO 8601 UTC ("...Z")
* ambientLux (number, required): >= 0
* motion (boolean, required)
* tempC (number, required): -50..100
* humidity (number, required): 0..100
* rssi (integer, optional): -120..0

Validation Rules
- Requests with missing required fields return 400 Bad Request
- Invalid field ranges return 400 Bad Request
- Invalid JSON returns 400 Bad Request
- Non-JSON content returns 415 Unsupported Media Type

---

## Endpoint 2: Telemetry Retrieval (React Dashboard)

### GET /telemetry
Retrieves historical telemetry data for one or multiple poles with optional filtering.

#### Query Parameters (all optional)

```
GET /telemetry?poleId=LW-001&startTime=2026-01-22T00:00:00Z&endTime=2026-01-22T23:59:59Z&limit=100
```

| Parameter | Type | Description | Default |
|-----------|------|-------------|---------|
| `poleId` | string | Filter by pole ID (comma-separated for multiple) | — (all poles) |
| `startTime` | string | ISO 8601 UTC start time | 24 hours ago |
| `endTime` | string | ISO 8601 UTC end time | now |
| `limit` | integer | Max results returned | 100 |
| `sort` | string | Order: `asc` or `desc` | `desc` (newest first) |

#### Request Headers
- X-API-Key: Authentication key

#### Response Body (JSON)

```json
{
  "status": "ok",
  "count": 2,
  "data": [
    {
      "poleId": "LW-001",
      "timestamp": "2026-01-22T21:15:00Z",
      "ambientLux": 12.5,
      "motion": true,
      "tempC": 18.4,
      "humidity": 62.0,
      "rssi": -67
    },
    {
      "poleId": "LW-002",
      "timestamp": "2026-01-22T21:14:55Z",
      "ambientLux": 8.2,
      "motion": false,
      "tempC": 19.1,
      "humidity": 58.5,
      "rssi": -72
    }
  ]
}
```

#### Filtering Examples

**Single pole, last 24 hours**:
```
GET /telemetry?poleId=LW-001
```

**Multiple poles, date range**:
```
GET /telemetry?poleId=LW-001,LW-002&startTime=2026-01-20T00:00:00Z&endTime=2026-01-22T23:59:59Z
```

**All poles, last 7 days, 500 results**:
```
GET /telemetry?limit=500&startTime=2026-01-15T00:00:00Z
```

---

## Responses

### POST /telemetry Success

```json
{
  "status": "ok",
  "ingested": 1,
  "serverTime": "2026-01-22T21:15:01Z",
  "requestId": "b83a9d21"
}
```

### 400 Bad Request (invalid JSON/validation)

```json
{
  "status": "error",
  "error": "validation_failed",
  "details": [
    {
      "field": "ambientLux",
      "message": "must be >= 0"
    }
  ]
}
```

### 401 Unauthorized (missing/invalid key)

```json
{
  "status": "error",
  "error": "unauthorized"
}
```

### 415 Unsupported Media Type (not JSON)

```json
{
  "status": "error",
  "error": "unsupported_media_type"
}
```

### 500 Internal Server Error

```json
{
  "status": "error",
  "error": "server_error"
}
```
