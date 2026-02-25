# LightWise Sprint 4 Plan

**Sprint Duration**: 2 weeks (Feb 18 - Mar 4, 2026)

---

## Firmware / Backend Development (Max)

#### Firmware modules
- Ambient module
- Mmwave module
- LED module
- LoRaWAN module
- Temperature/Humidity module
- Task scheduling / RTOS integration
- Initializations and main
- Firmware should be functinal by the end of sprint
- Firmware should be able to join network and send sensor data by end of sprint

#### Backend
- Implement Lambda handlers for API Gateway WebSocket:
    - `$connect`: handle new connections
    - `$disconnect`: handle disconnects
    - `$subscribe`: handle subscription requests

- Setup docker for local testing

---

## Frontend / UI (Isra)

#### UI README
- Document UI in `apps/web/README`

#### Websocket
- add WebSocket subscribe support
- Improve WS hook handling
- Show user-friendly errors if backend is down or payload is invalid.  
- Test backend to frontend integration end-to-end.

---

## AWS (Kirat)
- Connect LoRaWAN gateway to IoT Core
    - Provide Max with OTAA credentials:
        - **AppEUI** ( Application identifier (64-bit), Who provides it: AWS (shown in IoT Core → LoRaWAN → Destinations))
        - **AppKey** ( Root cryptographic key (128-bit), Who provides it: Generated in AWS when creating the LoRaWAN device)
    - Register LoRaWAN node
- API Gateway WebSocket:
    - Create WebSocket API with routes:
        - `$connect`
        - `$disconnect`
        - `$subscribe`
        - Integrate each route with Lambda handlers(Max implements the logic)

- Create DynamoDB Tables with primary key(check `docs/database-schema.md`)
- Create Timestream DB and Table - define database, table, retention, and dimensions.

- Share IDs, URLs, and credentials with Max & Isra
