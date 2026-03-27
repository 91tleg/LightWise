#ifndef SRC_COMMON_TYPES_LORAWAN_UPLINK_HPP
#define SRC_COMMON_TYPES_LORAWAN_UPLINK_HPP

#include <cstdint>
#include "types/sensor_health.hpp"

namespace lorawan
{

    /**
     * @brief Structured uplink data assembled by the FSM and encoded
     *        by the payload encoder before LoRaWAN transmission.
     *
     * Encoder maps SensorHealth to 3-bit values in flags1. Single-bit
     * fields are encoded directly as bits in flags1/flags2.
     */
    struct UplinkData
    {
        /* Telemetry */
        uint16_t lux_x10    { 0U }; /**< Ambient lux × 10          */
        int8_t   tempC      { 0  }; /**< Temperature °C            */
        uint8_t  humidity   { 0U }; /**< Relative humidity 0–100 % */
        uint8_t  lightLevel { 0U }; /**< Light output 0–100 %      */

        /* Sensor health — encoded as 3-bit fields in flags1 */
        SensorHealth ambientHealth { SensorHealth::TOTAL_FAILURE }; /**< Ambient sensor health */
        SensorHealth mmwaveHealth  { SensorHealth::TOTAL_FAILURE }; /**< mmWave sensor health  */

        /* Single-bit flags */
        bool motionDetected { false }; /**< Motion currently present          */
        bool thOk           { false }; /**< TH sensor healthy                 */
        bool lightOk        { false }; /**< Light drawing expected current  */
    };

} /* namespace lorawan */

#endif /* SRC_COMMON_TYPES_LORAWAN_UPLINK_HPP */
