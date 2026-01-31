# Hardware Specification

## 1. ESP32-S3-DevKitC-1-N8R8
| Spec | Value |
|------|-------|
| Digikey PN | 1965-ESP32-S3-DEVKITC-1-N8R8-ND |
| Vendor PN | ESP32-S3-DEVKITC-1-N8R8 |
| MCU | ESP32-S3 |
| Frequency | 240 MHz |
| Flash | 8 MB |
| RAM | 320 KB (SRAM) |

**Notes:** 8 MB flash supports dual firmware images for OTA updates. 320 KB RAM should be sufficient for our use case.

## 2. MMWAVE Sensor (C4001 24 GHz) - Qty: 2
| Spec | Value |
|------|-------|
| Digikey PN | 1738-SEN0609-ND |
| Vendor PN | SEN0609 |
| Detection Range | 25 mm |
| Interface | UART |
| Quantity | 2 units |

**Notes:** Dual sensors for sanity check. ESP32-S3 has sufficient UART peripherals.

## 3. Analog Ambient Light Sensor - Qty: 2
| Spec | Value |
|------|-------|
| Digikey PN | 1528-2748-ND |
| Vendor PN | 2748 |
| Quantity | 2 units |

**Notes:** Dual sensors provide cross-validation for light level measurements.

## 4. LoRaWAN Module (DFR1115-915)
| Spec | Value |
|------|-------|
| Digikey PN | 1738-DFR1115-915-ND |
| Vendor PN | DFR1115-915 |
| Frequency Band | US 915 MHz |
| Interface | I2C/UART(We have limited UART) |

## 5. Temp / Humidity Sensor
DHT11  
Have this aleady  

## 6. LoRaWAN Gateway (US915)
| Spec | Value |
|------|-------|
| Amazon PN | B0CG98XDLX |
| Processor | MT7628 (MIPS24KEc @ 580 MHz) |
| Flash | 32 MB |
| RAM | 128 MB DDR2 |
| Channels | 8 |
| Compatibility | AWS / Chirpstack |

**Notes:** Prototype-grade indoor gateway. Sufficient for development and testing.

---

## 7. AC Light Dimmer Module
| Spec | Value |
|------|-------|
| Amazon PN | B071X19VL1 |
| Input Voltage | 110–220 VAC |
| Control Logic | 3.3–5 V logic compatible |
| Max Load | 200 W (resistive), 50 W (LED) |
| Isolation | Optocoupler for logic/mains separation |

**Notes:**
- Module uses TRIAC-based phase angle control for AC dimming.
- Integrated zero-cross detection improves timing accuracy and reduces EMI.
- Logic interface is 3.3 V compatible, suitable for ESP32-S3 GPIO.
- Optocoupler isolation improves safety between low-voltage MCU and mains side.
- Requires non-blocking timing control or hardware timer usage for stable dimming.
- Must be mounted in insulated enclosure to meet electrical safety standards.
- Suitable for resistive and dimmable LED loads only (not inductive loads).

## 8. Light Bulb w/ Socket (Dimmable AC Load)

| Spec | Value |
|------|-------|
| Bulb Type | LED |
| Socket Type | E26 |
| Voltage Rating | 110–240 VAC |
| Power Rating | 9 W (60 W equivalent) |
| Dimming Support | TRIAC Phase-Cut Compatible |

**Notes:**
- Must be explicitly labeled as “dimmable”.
- Standard LED bulbs without dimming support will flicker or fail.
- Lower wattage LED bulbs reduce thermal stress on the TRIAC module.
- Warm white (2700K–3000K) provides more natural brightness scaling.

## 9. Wiring and Power Cord

| Spec | Value |
|------|-------|
| Cord Type | PS913163 3-Wire Appliance/Tool Cord |
| Wire Gauge | 16 AWG |
| Length | 9 ft |
| Current Rating | 13 A / 125 V AC |
| Power Rating | 1625 W |

**Notes:**
- Provides live, neutral, and earth conductors from wall outlet to dimmer and socket.
- Strain relief recommended for safety.
- Earth wire should be connected to socket chassis if metallic.

---

**Document Version**: 1.1   
**Last Updated**: January 27, 2026  