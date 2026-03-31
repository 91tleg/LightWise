#ifndef SRC_MODULES_LORAWAN_PAYLOADS_HEARTBEAT_HPP
#define SRC_MODULES_LORAWAN_PAYLOADS_HEARTBEAT_HPP

/**
 * @file  src/modules/lorawan/payloads/heartbeat.hpp
 * @brief LoRaWAN heartbeat payload encoder (2 bytes).
 *
 * Payload layout:
 *  Byte 0 : version = 0x01
 *  Byte 1 : type    = 0x00 (heartbeat)
 *
 * Sent periodically by the uplink task when no telemetry event has
 * occurred. Signals device is alive without carrying sensor data.
 */

#include <cstdint>
#include <span>

namespace lorawan::payload::heartbeat
{
    constexpr uint8_t kVersion { 0x01U };
    constexpr uint8_t kType    { 0x00U };
    constexpr size_t  kSize    { 2U    };

    /**
     * @brief Encode a heartbeat frame into the output buffer.
     *
     * @param buf  Output buffer of exactly kSize bytes.
     */
    inline void encode( std::span< uint8_t, kSize > buf ) noexcept
    {
        buf[ 0U ] = kVersion;
        buf[ 1U ] = kType;
    }

} /* namespace lorawan::payload::heartbeat */

#endif /* SRC_MODULES_LORAWAN_PAYLOADS_HEARTBEAT_HPP */
