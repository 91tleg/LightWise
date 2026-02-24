#ifndef SRC_MODULES_LORAWAN_PAYLOADS_UPLINK_PAYLOAD_V1_HPP
#define SRC_MODULES_LORAWAN_PAYLOADS_UPLINK_PAYLOAD_V1_HPP

#include <cstddef>
#include <cstdint>

#include "uplink_payload.hpp"

namespace lorawan
{ 
    /**
     * @brief LoRaWAN uplink payload encoder (version 1).
     *
     * Encodes application uplink data into the fixed-size
     * V1 LoRaWAN payload format.
     *
     * Payload format version: 0x01
     * Total encoded size: 7 bytes
     *
     * This class is stateless and safe to reuse across uplink
     * transmissions.
     */
    class UplinkPayloadV1 final : public UplinkPayload
    {
    public:
        /**
         * @brief Get payload size in bytes.
         * 
         * @return Payload size.
         */
        size_t size() const override;

        /**
         * @brief Encode uplink data into a raw payload buffer.
         *
         * @param[in]  data    Structured uplink data to encode.
         * @param[out] outBuf  Output buffer (must be at least size() bytes).
         *
         * @note No bounds checking is performed on outBuf.
         * @note Payload layout is fixed for V1.
         */
        void encode( const UplinkData & data,
                     uint8_t * outBuf ) const override;

    private:
        static constexpr size_t kSize = 7U; /**< Fixed encoded payload size (bytes) */
    };
} /* namespace lorawan */

#endif /* SRC_MODULES_LORAWAN_PAYLOADS_UPLINK_PAYLOAD_V1_HPP */
