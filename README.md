![Lightwise Logo](assets/lightwise-logo.png)

[![Firmware CI](https://github.com/91tleg/lightwise/actions/workflows/firmware-ci.yml/badge.svg)](https://github.com/91tleg/lightwise/actions/workflows/firmware-ci.yml)
[![Frontend CI](https://github.com/91tleg/lightwise/actions/workflows/frontend-ci.yml/badge.svg)](https://github.com/91tleg/lightwise/actions/workflows/frontend-ci.yml)
[![Frontend Deploy](https://github.com/91tleg/lightwise/actions/workflows/frontend-deploy.yml/badge.svg)](https://github.com/91tleg/lightwise/actions/workflows/frontend-deploy.yml)
[![Lambda CI](https://github.com/91tleg/lightwise/actions/workflows/lambda-ci.yml/badge.svg)](https://github.com/91tleg/lightwise/actions/workflows/lambda-ci.yml)
[![Lambda Deploy](https://github.com/91tleg/lightwise/actions/workflows/lambda-deploy.yml/badge.svg)](https://github.com/91tleg/lightwise/actions/workflows/lambda-deploy.yml)

LightWise is a smart streetlight telemetry platform that collects real-time sensor data from distributed IoT streetlight nodes and provides live monitoring, analytics, and system insights through a web dashboard.

The system is designed as a scalable B2B SaaS solution for municipalities and infrastructure operators, enabling intelligent lighting control, traffic-aware optimization, and automatic brightness adjustment based on motion sensing and traffic detection.

---

## Documentation Structure

This README provides a high-level overview only.

Detailed technical and planning documentation is maintained in the `/docs` directory:

- **System Architecture** — Overall platform design and data flow  
- **API Contracts** — Telemetry ingestion and service interfaces  
- **Firmware Design** — ESP32 and streetlight controller behavior  
- **Hardware Specifications** — Sensor and lighting component selection  
- **Sprint Plans & Backlog** — Project planning and progress tracking  
- **Git Workflow** — Development standards  

Please refer to the appropriate document for details.

---

## Core Capabilities (MVP)

- Real-time telemetry ingestion from streetlight nodes  
- Cloud-based data processing and storage  
- Live monitoring dashboard  
- Historical analytics and reporting  
- Secure authentication and multi-tenant support  
- Adaptive lighting control based on human and vehicle activity  

---

## Repository Structure
/.github -> Github actions workflow  
/assets -> Images  
/docs -> Design, planning, and architecture documentations  
/firmware -> ESP32 streetlight controller code  
/backend -> Cloud services (Lambda, APIs)  
/frontend -> Web dashboard  
/scripts -> Reusable scripts  

---

**Version:** 0.1  
**Last Updated:** January 24, 2026  