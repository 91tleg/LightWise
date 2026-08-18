# ADR-0001: Use LoRaWAN for Edge Node Connectivity

## Context

LightWise edge nodes are ESP32-based streetlight controllers deployed outdoors,
one per pole, across a municipal-scale area (potentially thousands of nodes per
deployment). Poles are grid-powered but physically dispersed over large distances,
and connectivity must tolerate intermittent loss without taking down the system.

Requirements driving the connectivity choice:

- Range sufficient to cover a city block/district per gateway (poles are not
  co-located; dense installations like WiFi APs on every pole are not viable)
- Low bandwidth is fine — payloads are small telemetry/event messages
  (motion, on/off, brightness, sensor readings), not video or bulk data
- Low per-device recurring cost at fleet scale (thousands of nodes)
- Ability to operate with confirmed uplinks and encrypted payloads at the
  device level, without depending on a third-party carrier network

## Decision

Use **LoRaWAN** (Class C, confirmed uplinks) as the radio protocol between edge
nodes and gateways, with LoRaWAN-native encryption for payload security. Gateways
bridge LoRaWAN traffic to AWS IoT Core over MQTT/mTLS.

## Alternatives Considered

| Option | Pros | Cons | Why not chosen |
|---|---|---|---|
| **WiFi** | High bandwidth, ubiquitous hardware, easy local dev/testing | Short range (~50-100m outdoors), requires dense AP infrastructure across the deployment area, comparatively power-hungry | Doesn't fit dispersed pole topology; would need far more infrastructure than a handful of gateways per district |
| **Cellular (LTE-M / NB-IoT)** | Carrier-grade coverage, no gateway to deploy/maintain, works almost anywhere | Per-device SIM/data cost recurring at fleet scale, dependent on carrier network availability and pricing, higher power draw than LoRa | Cost scales linearly with device count; undermines the "30-50% maintenance cost reduction" value proposition at thousands of poles |
| **Zigbee / other mesh** | Low power, mature ecosystem, local mesh resilience | Short range per hop (~10-100m), requires many more gateway/coordinator nodes for city-scale coverage, mesh hop failures compound and complicate the "fail independently" design goal | Coverage economics worse than LoRaWAN's star topology at this density; more failure surface across hops |
| **LoRaWAN (chosen)** | Long range (multi-km, few gateways needed), very low power, one-time hardware cost with no per-message carrier fee, encrypted confirmed uplinks built in | Low bandwidth (fine for our payload sizes), requires deploying/maintaining our own gateways, regulatory duty-cycle limits in some regions | Best fit for sparse, power-constrained, low-bandwidth telemetry at municipal scale |
