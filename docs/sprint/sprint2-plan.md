# LightWise Sprint 2 Plan

**Sprint Duration**: 2 weeks (Jan 21 - Feb 3, 2026) 

## Sprint Overview

### Primary Objective
Define the technical foundation of the LightWise platform through planning, architecture, and interface definitions required before full implementation begins.

### Target Outcomes
By the end of Sprint 2, the team aims to have:
- A complete system architecture design
- A documented hardware specification with component justification
- Defined firmware architecture and responsibilities
- A stable telemetry API contract
- Database schema design and storage strategy
- Working frontend with basic components

## Planned Deliverables

### 1. System Architecture Design
**Due**: Jan 25, 2026

**Deliverables**:
- High-level block diagram of the LightWise system
- Data flow diagram between streetlight node, gateway, cloud, and dashboard
- Communication protocol selection

**Acceptance Criteria**:
- [ ] Architecture diagram includes all major components
- [ ] Data flow is clear and addresses latency/bandwidth requirements
- [ ] Protocol choices justified against alternatives

---

### 2. Hardware Specification
**Due**: Jan 30, 2026

**Deliverables**:
- ESP32 variant selection with justification
- Sensor component list (light, temperature, humidity, motion detection)
- Cost analysis per pole unit

**Acceptance Criteria**:
- [ ] All sensors specified with part numbers and datasheets
- [ ] BOM (Bill of Materials) created with costs
- [ ] Technical specifications document complete

---

### 3. Firmware Architecture Design
**Due**: Feb 1, 2026

**Deliverables**:
- Firmware module breakdown (sensor drivers, freeRTOS tasks)
- Communication interfaces definition (SPI, I2C, UART)
- Sensor data processing pipeline (sampling, filtering, aggregation)
- Error handling and watchdog strategy

**Acceptance Criteria**:
- [ ] Module architecture documented with clear interfaces
- [ ] Task diagram and priorities defined

---

### 4. API Contract
**Due**: Jan 24, 2026

**Deliverables**:
- API endpoint specification (POST /telemetry, GET /telemetry)
- Request/response JSON schemas with validation rules
- Error handling and status code definitions
- Rate limiting strategy

**Acceptance Criteria**:
- [ ] API contract documented and versioned (v0.1)
- [ ] All endpoints include request/response examples
- [ ] Validation rules clearly defined
- [ ] Error responses standardized
- [ ] Ready for mock implementation in dashboard

---

### 5. Database Schema Design
**Due**: Jan 28, 2026

**Deliverables**:
- Table schema design with partition/sort keys
- Index strategy for efficient queries (by poleId, timestamp)
- Data retention and TTL policy
- Capacity provisioning estimates
- Query patterns documentation

**Acceptance Criteria**:
- [ ] Schema supports all query patterns from API
- [ ] TTL policy defined for cost optimization
- [ ] Capacity planning justified
- [ ] Example queries documented

---

### 6. Frontend Setup & UI Components
**Due**: Jan 28, 2026

**Deliverables**:
- React project setup
- Base UI layout
- Initial dashboard components

**Acceptance Criteria**:
- [ ] Frontend project builds and runs locally
- [ ] Dashboard layout renders correctly
- [ ] Dashboard layout renders correctly

---

**Last Updated**: Jan 23, 2026  