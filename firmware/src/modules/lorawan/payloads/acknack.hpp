#ifndef SRC_MODULES_LORAWAN_PAYLOADS_ACKNACK_HPP
#define SRC_MODULES_LORAWAN_PAYLOADS_ACKNACK_HPP

/**
 * @file  src/modules/lorawan/payloads/acknack.hpp
 * @brief LoRaWAN ACK/NACK uplink payload encoder (5 bytes).
 *
 * Payload layout:
 *  Byte 0 : version      = 0x01
 *  Byte 1 : type         = 0x02 (ack/nack)
 *  Byte 2 : responseCode (0x00=ACK, 0x01=NACK)
 *  Byte 3 : echoCmd      (DownlinkCmd being responded to)
 *  Byte 4 : reasonCode   (0x00=Ok, else error code)
 *
 * Sent directly from the downlink task. Not queued through
 * the telemetry uplink path.
 */

#include <cstdint>
#include <span>

namespace lorawan
{
    struct AckNack;
}

namespace lorawan::payload::acknack
{
    static constexpr uint8_t kVersion { 0x01U };
    static constexpr uint8_t kType    { 0x02U };
    static constexpr size_t  kSize    { 5U    };

    /**
     * @brief Encode an AckNack response into a fixed-size buffer.
     *
     * @param ackNack  Response to encode.
     * @param buf      Output buffer of exactly kSize bytes.
     */
    void encode( const lorawan::AckNack & ackNack,
                 std::span< uint8_t, kSize > buf ) noexcept;

} /* namespace lorawan::payload::acknack */

#endif /* SRC_MODULES_LORAWAN_PAYLOADS_ACKNACK_HPP */
