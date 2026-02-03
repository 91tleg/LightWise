![Lightwise Logo](assets/lightwise-logo.png)

[![Firmware CI](https://github.com/91tleg/lightwise/actions/workflows/firmware-ci.yml/badge.svg)](https://github.com/91tleg/lightwise/actions/workflows/firmware-ci.yml)
[![Web CI](https://github.com/91tleg/lightwise/actions/workflows/web-ci.yml/badge.svg)](https://github.com/91tleg/lightwise/actions/workflows/web-ci.yml)
[![Web Deploy](https://github.com/91tleg/lightwise/actions/workflows/web-deploy.yml/badge.svg)](https://github.com/91tleg/lightwise/actions/workflows/web-deploy.yml)
[![API CI](https://github.com/91tleg/lightwise/actions/workflows/api-ci.yml/badge.svg)](https://github.com/91tleg/lightwise/actions/workflows/api-ci.yml)
[![API Deploy](https://github.com/91tleg/lightwise/actions/workflows/api-deploy.yml/badge.svg)](https://github.com/91tleg/lightwise/actions/workflows/api-deploy.yml)

LightWise is a smart streetlight telemetry and control platform that collects real-time data from distributed IoT-enabled streetlights and delivers actionable insights through a centralized web dashboard.

Designed as a scalable B2B SaaS solution for municipalities and infrastructure operators, LightWise enables intelligent lighting management with features such as:

- Real-time monitoring and analytics  
- Remote brightness and power control  
- Traffic-aware lighting optimization  
- Motion-based automatic dimming and activation  
- Energy efficiency optimization  
- Predictive maintenance and fault detection  

The platform integrates embedded firmware, cloud-based processing, and a web dashboard to provide centralized control, real-time monitoring, and automation for smart city lighting systems.

By leveraging data-driven automation, LightWise helps cities reduce energy consumption, improve public safety, and optimize operational costs.

---

## Documentation Structure

This README provides a high-level overview only.

Detailed technical and planning documentation is maintained in the `/docs` directory:

- [System Architecture](docs/system-architecture.md): Overall platform design and data flow  
- [API Contracts](docs/api-contract-v1.0.md): Telemetry ingestion and service interfaces  
- [Firmware Architecture](firmware/docs/firmware-architecture.md): ESP32 and component flow  
- [Hardware Specifications](firmware/docs/hw-spec.md): Hardware component specification  
- [Sprint Plans & Backlog](docs/sprint/): Project planning and progress tracking  
- [Contributing](CONTRIBUTING.md): Development standards  

Please refer to the appropriate document for details.

---

## Features  

- Real-time telemetry ingestion from streetlight nodes  
- Cloud-based data processing and storage  
- Live monitoring dashboard  
- Historical analytics and reporting  
- Secure authentication and multi-tenant support  
- Adaptive lighting control based on human and vehicle activity  

---

## Repository Structure

```
LightWise/
├── .github/
│   └── workflows/    # CI/CD pipelines (firmware, frontend, lambda)
│
├── apps/
│   ├── api/          # Serverless backend (AWS Lambda functions)
│   ├── firmware/     # Embedded firmware (ESP32, device drivers, RTOS)
│   └── web/          # Web dashboard (React frontend)
│
├── assets/           # Diagrams, images, logo
├── docs/             # System-level documentation
├── scripts/          # Build, deployment, and automation scripts
│
├── .gitignore
├── LICENSE
├─- README.md         # Main project documentation
└── CONTRIBUTING.md   # Contributing guideline
```

## Quick Links

- [Firmware](firmware/)
- [Lambda](apps/api/)
- [Frontend](apps/web/)
- [Documentation](docs/)

## Project Setup Guide

This repository contains three main components:

- **Web UI** — React frontend  
- **Backend API** — AWS Lambda (Python)  
- **Firmware** — PlatformIO embedded firmware  

Follow the section for the component you want to run.

---

### Prerequisites

#### Common
- Git
- [Node.js](https://nodejs.org)
- [Python](https://python.org)

#### Firmware Development

Install the **PlatformIO IDE extension** for VSCode:

1. Install VSCode  
   https://code.visualstudio.com

2. Open Extensions Marketplace  
3. Search for **PlatformIO IDE**  
4. Install and reload VSCode  

---
#### React Web Application

1. Install Dependencies
```bash
    cd apps/web
    npm install
```
2. Start Development Server
```bash
    npm run dev
```
3. Production Build
```bash
    npm run build
```
#### Lambda Backend (Python)

1. Create Virtual Environment
```bash
    #Linux / MacOS
    python3 -m venv .venv
    source .venv/bin/activate

    #Windows
    python -m venv .venv
    .venv\Scripts\activate
```

2. Install dependencies
```bash
    pip install -r requirements.txt
```

---

**Version:** 1.1  
**Last Updated:** February 2, 2026