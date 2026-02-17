# Overview

This repository contains the serverless backend for managing streetlight nodes communicating via LoRaWAN. The API decodes uplink payloads, stores metrics, daily analytics, and pushes real-time updates to a frontend dashboard via WebSockets.

The MVP focuses on device onboarding, telemetry storage, uplink commands, and real-time updates, with Cognito authentication and multi-tenant support.

---

## Features

### Uplink
- Decode raw LoRaWAN payloads:
- Store metrics in Timestream
- Push real-time updates to frontend via WebSocket

### Device Management
- Add/update device metadata
- Register/unregister device to a user
- Ownership checks
- Multi-tenant support

### Users
- Cognito for authentication
- User-device mapping stored in DynamoDB

### Metrics & Analytics
- Store uplink metrics in Timestream
- Query metrics for dashboards
