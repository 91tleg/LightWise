# Hardware Specification

## 1. ESP32-S3-DevKitC-1-N8R8
| Spec | Value |
|------|-------|
| Digikey PN | 1965-ESP32-S3-DEVKITC-1-N8R8-ND |
| Vendor PN | ESP32-S3-DEVKITC-1-N8R8 |
| MCU | ESP32-S3 |
| Frequency | 240 MHz |
| Flash | 8 MB |
| RAM | 320 KB SRAM, 8 MB PSRAM |

**Notes:** 8 MB flash supports dual firmware images for OTA updates.

## 2. MMWAVE Sensor
| Spec | Value |
|------|-------|
| Digikey PN | 1738-SEN0609-ND |
| Vendor PN | SEN0609 |
| Detection Range | 25 mm |
| Interface | UART |

**Notes:** Dual sensors for sanity check. ESP32-S3 has sufficient UART peripherals.

## 3. Analog Ambient Light Sensor
| Spec | Value |
|------|-------|
| Digikey PN | 1528-2748-ND |
| Vendor PN | 2748 |

**Notes:** Dual sensors provide cross-validation for light level measurements.

## 4. LoRaWAN Module (DFR1115-915)
| Spec | Value |
|------|-------|
| Digikey PN | 1738-DFR1115-915-ND |
| Vendor PN | DFR1115-915 |
| Frequency Band | US 915 MHz |
| Interface | I2C/UART |

**Notes:** Confirmed working with I2C. Supports US frequency and class C.

## 5. Temperature & Humidity Sensor
| Spec | Value |
|------|-------|
| Digikey PN | 1528-4566-ND |
| Vendor PN | 4566 |
| Interface | I2C |

**Notes:** DHT11 works but is unreliable. swapping to AHT20 for better speed and accuracy.

## 6. LoRaWAN Gateway (US915)
| Spec | Value |
|------|-------|
| Amazon PN | B0CG98XDLX |
| Processor | MT7628 (MIPS24KEc @ 580 MHz) |
| Flash | 32 MB |
| RAM | 128 MB DDR2 |
| Channels | 8 |
| Compatibility | AWS / Chirpstack |

---

**Document Version**: 1.2  
**Last Updated**: May 2nd, 2026  
