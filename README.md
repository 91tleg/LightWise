![Lightwise Logo](docs/assets/lightwise-logo.png)

[![Firmware CI](https://github.com/91tleg/lightwise/actions/workflows/firmware-ci.yml/badge.svg)](https://github.com/91tleg/lightwise/actions/workflows/firmware-ci.yml)
[![Web CI](https://github.com/91tleg/lightwise/actions/workflows/web-ci.yml/badge.svg)](https://github.com/91tleg/lightwise/actions/workflows/web-ci.yml)
[![API CI](https://github.com/91tleg/lightwise/actions/workflows/api-ci.yml/badge.svg)](https://github.com/91tleg/lightwise/actions/workflows/api-ci.yml)
[![API Deploy](https://github.com/91tleg/lightwise/actions/workflows/api-deploy.yml/badge.svg)](https://github.com/91tleg/lightwise/actions/workflows/api-deploy.yml)

LightWise is a fault-tolerant telemetry platform designed to manage distributed, sensor-rich lighting infrastructure at scale. By bridging the gap between autonomous embedded firmware and cloud-based analytics, LightWise enables municipalities to transform standard streetlights into intelligent, self-healing edge nodes.

---

## The Problem: "Truck Rolls"

Traditional streetlight management is reactive and costly. Municipalities have **no visibility** into infrastructure health until a bulb burns out, a sensor fails, or a citizen complains. When problems occur, technicians must physically drive to each location to diagnose and repair—creating expensive, inefficient "truck rolls."

LightWise eliminates truck rolls through:

- **Remote Diagnostics**: Real-time telemetry streams from every streetlight, enabling operations teams to diagnose issues from the office

- **Autonomous Health Monitoring**: Embedded fault detection automatically identifies failures and enters graceful degraded modes

- **Visibility-Driven Decisions**: Dashboard insights mean technicians are dispatched only when remote diagnostics confirm actual hardware issues

**Impact**: 30–50% reduction in maintenance costs, faster response to critical failures, and better asset utilization across thousands of streetlights.

---

## Key Features

### Intelligent Edge Nodes
- **Autonomous Operation**: Local decision-making allows each streetlight to function independently
- **Fault Tolerance**: Automatic degradation modes maintain core functionality during partial sensor failure
- **Health Self-Assessment**: Device-side validation ensures data quality before transmission

### Robust Connectivity
- **LoRaWAN Integration**: Long-range, low-power communication optimized for dense urban coverage
- **Hybrid Telemetry**: Event-driven alerts for critical issues + periodic heartbeats for health monitoring
- **Graceful Degradation**: System remains operational even during cloud connectivity loss

### Cloud & Analytics
- **Real-time Dashboard**: Unified view of entire fleet health with drill-down capabilities
- **Predictive Analytics**: Historical trend analysis supports proactive maintenance scheduling

---

## Documentation Structure

This README provides a high-level overview only.

Detailed technical and planning documentation is maintained in the `/docs` directory:

- [System Architecture](docs/system-architecture.md): Overall platform design and data flow  
- [Database Schema](docs/database-schema.md): Data models, access patterns, and retention strategy   
- [API Contracts](docs/api/): Telemetry ingestion and service interfaces  
- [Firmware Architecture](firmware/docs/firmware-architecture.md): ESP32 and component flow  
- [Hardware Specifications](firmware/docs/hw-spec.md): Hardware component specification  
- [Sprint Plans & Backlog](docs/sprint/): Project planning and progress tracking  
- [Contributing](CONTRIBUTING.md): Development standards  
- [License](LICENSE): Project licensing terms 

Please refer to the appropriate document for details.

---

## Repository Structure

```
LightWise/
├── .github/
│   └── workflows/    # CI/CD pipelines (firmware, frontend, lambda)
│
├── apps/
│   ├── api/          # Serverless backend (AWS Lambda functions)
│   └── web/          # Web dashboard (React frontend)
│
├── docs/             # System-level documentation
├── firmware/         # Embedded firmware (device drivers, RTOS)
├── scripts/          # Build, deployment, and automation scripts
│
├── .gitignore
├── LICENSE
├─- README.md         # Main project documentation
└── CONTRIBUTING.md   # Contributing guideline
```

---

## Quick Links

- [Firmware](firmware/)
- [Backend](apps/api/)
- [Frontend](apps/web/)
- [Documentation](docs/)

---

## Project Setup Guide

This repository contains three main components:

- **Web UI** — React frontend  
- **Backend API** — AWS Lambda (Python)  
- **Firmware** — PlatformIO embedded firmware  

Follow the section for the component you want to run.

---

### Prerequisites

- **Git**
- **Node.js** 16+ (for frontend)
- **Python 3.8+** (for backend)
- **PlatformIO CLI** (for firmware; or use VSCode extension)

#### Embedded Firmware

```bash
cd firmware
pio run
pio run -t upload  # Flash firmware to device
pio device monitor # Monitor logs
```

---
#### React Web Application

1. Install Dependencies

```bash
    cd apps/web
    npm install
```

2. Start Development Server

```bash
    npm start
```

3. Production Build

```bash
    npm run build
```

#### Lambda Backend (Python)

1. Create Virtual Environment

```bash
    # Linux / MacOS
    python3 -m venv .venv
    source .venv/bin/activate

    # Windows
    python -m venv .venv
    .venv\Scripts\activate
```

2. Install dependencies

```bash
    pip install -r requirements.txt
```

---

**Version:** 1.4  
**Last Updated:** May 6, 2026