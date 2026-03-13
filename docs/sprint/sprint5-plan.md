# LightWise Sprint 5 Plan

**Sprint Duration:** Mar 4 – Mar 18, 2026  
**Goal:** Improve dashboard usability while building deeper understanding of the backend architecture to prepare for upcoming feature development.

---

# Workstreams

## 1. Frontend — Navigation & Usability Improvements
**Owner:** Isra Sookun

### Objective
Improve the dashboard UI so operators can quickly navigate the system and locate important infrastructure data.

### Focus
- Simplify dashboard navigation.
- Improve map interaction and pole inspection workflow.
- Make monitoring information easier to scan and interpret.
- Reduce unnecessary UI complexity.

### Tasks
- Review current dashboard navigation flow.
- Simplify page structure and remove redundant UI elements.
- Improve map-based interaction for pole selection.
- Standardize layout and visual hierarchy across views.

### Deliverables
- Updated UI layout with improved navigation.
- Improved pole inspection workflow.
- Consistent dashboard layout patterns.

### Success Criteria
- Operators can navigate the dashboard more easily.
- Important monitoring data is easier to locate.
- Fewer steps required to access pole details or system status.

---

## 2. Firmware — Stability Maintenance & Downlink Interface Documentation
**Owner:** Max Chou

### Objective
Maintain firmware stability while documenting the command interface required for future remote lighting control features.

### Focus
- Ensure the current firmware continues operating reliably.
- Define and document the command structure used for device downlink control.
- Align firmware expectations with backend implementation.

### Tasks
- Perform routine firmware testing and stability checks.
- Document the **LoRaWAN downlink payload format** used to control devices.
- Define the **API contract** that the backend will use to issue downlink commands.
- Map how backend commands translate into device payloads.

### Deliverables
- `downlink-payload-v1.md`  
  Documentation describing the LoRaWAN payload structure for device commands.

- `downlink-api-contract.md`  
  API contract defining how the frontend/backend issues downlink commands.

- Firmware stability notes and observations.

### Success Criteria
- Firmware continues to operate without regressions.
- Downlink payload schema clearly documented.
- API contract defined so frontend, backend, and firmware share a consistent command interface.


---

## 3. Backend — Architecture Research
**Owner:** Jaskirat Singh

### Objective
Understand the existing backend architecture to enable future feature development within the current codebase structure.

### Focus
- Explore how the backend codebase is organized.
- Understand request flow and data processing.
- Identify key modules and services.
- Learn how infrastructure is defined and deployed using AWS SAM.

### Tasks
- Trace request flow from API entry point to backend logic.
- Identify core components of the backend system.


### Deliverables

- Trace request flow from API entry point to backend logic.
- Identify core components of the backend system.
- Review and understand the **SAM infrastructure template (`template.yml`)**.
- Document how backend services, APIs, and resources are defined in the infrastructure configuration.


### Success Criteria
- Backend structure clearly documented.
- Understands where new features should be implemented.
- Key backend modules and responsibilities identified.
- Understanding of how infrastructure is defined in the SAM template.

---

# Sprint Summary

| Workstream | Owner | Focus |
|---|---|---|
| Frontend | Isra Sookun | Navigation and UI usability |
| Firmware | Max Chou | Stability and downlink interface documentation |
| Backend | Jaskirat Singh | Architecture and SAM infrastructure research |
