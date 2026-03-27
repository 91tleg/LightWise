#ifndef SRC_MODULES_LORAWAN_PAYLOADS_V1_HPP
#define SRC_MODULES_LORAWAN_PAYLOADS_V1_HPP

/**
 * @file  src/modules/lorawan/payloads/v1.hpp
 * @brief LoRaWAN uplink payload encoder — version 1 (9 bytes).
 *
 * Payload layout:
 *  Byte 0     : version    = 0x01
 *  Byte 1     : type       = 0x01 (telemetry)
 *  Byte 2–3   : lux_x10    (uint16 BE, ambient light × 10)
 *  Byte 4     : tempC      (int8, degrees Celsius)
 *  Byte 5     : humidity   (uint8, 0–100 %)
 *  Byte 6     : flags1     (see below)
 *  Byte 7     : flags2     (see below)
 *  Byte 8     : lightLevel (uint8, current light output 0–100 %)
 *
 * flags1 layout:
 *  Bits 0–2 : Ambient health  (3-bit encoded, see HealthBits)
 *  Bits 3–5 : mmWave health   (3-bit encoded, see HealthBits)
 *  Bit  6   : MotionPresent   (1 = motion detected)
 *  Bit  7   : ThOk            (1 = TH sensor healthy)
 *
 * flags2 layout:
 *  Bit  0   : lightOk         (1 = AC bulb drawing expected current)
 *  Bit  1   : OverallOk       (1 = all sensors healthy)
 *  Bits 2–7 : Reserved
 *
 * Health 3-bit encoding (HealthBits):
 *  0b000 = TOTAL_FAILURE
 *  0b001 = PRIMARY_FAIL
 *  0b010 = SECONDARY_FAIL
 *  0b011 = DEGRADED
 *  0b100 = SYSTEM_OK
 */

#include <cstdint>
#include <span>

#include "types/sensor_health.hpp"

namespace lorawan
{
    struct UplinkData;
}

namespace lorawan::payload::v1
{
    static constexpr uint8_t kVersion { 0x01U };
    static constexpr uint8_t kType    { 0x01U };
    static constexpr size_t  kSize    { 9U    };

    /**
     * @brief Encode a 3-bit health value for packing into flags bytes.
     *
     * @param health  Sensor health classification.
     * @return        3-bit encoded value (0b000–0b100).
     */
    [[nodiscard]] constexpr uint8_t encodeHealth( SensorHealth health ) noexcept
    {
        switch( health )
        {
            case SensorHealth::SYSTEM_OK:      return 0b100U;
            case SensorHealth::DEGRADED:       return 0b011U;
            case SensorHealth::SECONDARY_FAIL: return 0b010U;
            case SensorHealth::PRIMARY_FAIL:   return 0b001U;
            case SensorHealth::TOTAL_FAILURE:  return 0b000U;
            default:                           return 0b000U;
        }
    }

    /**
     * @brief Encode uplink data into a V1 payload buffer.
     *
     * @param data  Structured uplink data to encode.
     * @param buf   Output buffer of exactly kSize bytes.
     */
    void encode( const lorawan::UplinkData & data,
                 std::span< uint8_t, kSize > buf ) noexcept;

} /* namespace lorawan::payload::v1 */

#endif /* SRC_MODULES_LORAWAN_PAYLOADS_V1_HPP */
