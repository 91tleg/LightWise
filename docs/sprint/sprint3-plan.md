# LightWise Sprint 3 Plan

**Sprint Duration**: 2 weeks (Feb 4 - Feb 18, 2026)

---

## Firmware / Backend Development (MAX)

#### Setup Firmware CI
- Configure GitHub Actions to automatically build and test firmware.

#### LoRaWAN Sensor Library
- Write non-blocking LoRaWAN sensor driver.
- Add unit tests using Google Test.

#### Human Presence Sensor Library
- Write non-blocking C4001 human presence sensor driver.
- Add unit tests using Google Test.

#### Lambda API
- Write Lambda functions for processing raw LoRaWAN payloads.
- Implement database write functionality with error handling.
- Add unit tests for Lambda logic locally using mock events.

---

## Frontend / UI / Documentation (ISRA)

#### User Input Lightpole Coordinates UI
- Build frontend interface to enter latitude/longitude manually or via map pin.
- Validate inputs for correct format and range.

#### Setup Web CI
- Configure GitHub Actions to build and test frontend automatically.

#### UI Design Documentation
- Document UI design in GitHub README.
- Include screenshots and flow diagrams.
- Update SRS UI section.

#### Update Architecture Design
- Update architecture diagram with new services (Lambda, IoT Core, TimeStream).
- Document data flow and integration points.

---

## AWS (KIRAT)

#### Register LoRaWAN Gateway on AWS IoT Core
- Test registering the gateway and verify connection.
- Validate device credentials and IAM permissions.

#### Database Schema Design
- Design NoSQL schema to support multi-tenancy and historic sensor data queries.
- Include indexes for efficient queries.
- Document schema decisions and trade-offs.

#### Security and IAM
- Create IAM roles so Lambda can only write to specific database tables.
- Ensure least-privilege principle is followed.
