# ADR-0002: Use FreeRTOS on ESP32 Edge Nodes Instead of a Bare-Metal Loop

## Context

Each streetlight node runs several concurrent, timing-sensitive responsibilities:

- Acquiring sensor data (ambient light, motion, temperature, humidity) on
  independent cadences
- Local filtering/aggregation of that data
- Managing LoRaWAN Class C radio state: the receive window is effectively
  always open between transmissions, so the node must listen continuously for
  downlink commands while still handling uplinks, retries, and gateway
  acknowledgements
- Local fault detection and graceful degradation when a sensor or subsystem
  fails (an explicit design goal — nodes must "fail independently without
  system-wide impact")
- Responding to control commands issued from the cloud (light on/off/dim) —
  Class C's near-continuous receive window is what makes low-latency downlink
  control viable in the first place

Nodes are grid-powered, so there is no sleep/wake duty-cycling to schedule;
power efficiency is not the driver here. The driver is that Class C's
always-listening radio must run concurrently with everything else without any one of them
blocking the radio's receive availability or vice versa. On a single-threaded
bare-metal loop, one blocking operation (e.g. a slow I2C sensor read) delays
how quickly the node can react to an inbound downlink, and a long uplink
transmit/ack sequence competes with sensor sampling for the same thread.

## Decision

Run firmware on **FreeRTOS** (ESP-IDF default) rather than a
bare-metal superloop, structuring node responsibilities as separate tasks
(e.g. sensor sampling, LoRaWAN Class C radio/receive-window management, local
fault detection, and cloud command handling)
so the always-on receive path is never blocked by other work.

## Alternatives Considered

| Option | Pros | Cons | Why not chosen |
|---|---|---|---|
| **Bare-metal superloop** | Simplest possible model, no scheduler overhead, fully deterministic if hand-tuned, smallest memory footprint | All work shares one thread of control — a slow or blocking operation (sensor I/O, a long uplink sequence) delays servicing the Class C receive window and vice versa; keeping the radio "always listening" while interleaving sensor/fault-check work requires a hand-rolled state machine, which gets fragile as responsibilities grow | Doesn't scale cleanly to running a continuously-listening radio alongside independently-timed sensor/fault work; increases risk of one subsystem's fault (e.g. a hung sensor) delaying downlink responsiveness too, undermining the "fail independently" design goal |
| **Full embedded OS (e.g. Zephyr, embedded Linux)** | Richer feature set (networking stacks, drivers, filesystems), stronger process isolation | Heavier resource footprint, more complex build/toolchain, more than this node's responsibilities need | Overkill for a single-purpose sensor/radio node; ESP-IDF + FreeRTOS is the natively supported combination for ESP32 |
| **FreeRTOS on ESP32 (chosen)** | Native, well-supported ESP-IDF default with mature LoRaWAN and sensor driver ecosystem; preemptive task scheduling lets a dedicated radio task keep the Class C receive window serviced continuously while sensor sampling and fault checks run on their own tasks without stalling it; built-in kernel objects fit the always-on receive plus event-driven uplink model directly | Adds scheduler/context-switch overhead vs. bare-metal; introduces concurrency concerns (race conditions, priority inversion, stack sizing per task) that we must manage correctly | Best match for a multi-responsibility, fault-isolated node that must keep a Class C radio continuously receptive on ESP32-class hardware |
