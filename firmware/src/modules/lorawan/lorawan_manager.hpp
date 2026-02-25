#ifndef SRC_MODULES_LORAWAN_LORAWAN_MANAGER_HPP
#define SRC_MODULES_LORAWAN_LORAWAN_MANAGER_HPP

#include <cstdint>
#include <cstddef>

namespace lorawan
{
    class LorawanSensor;
    class UplinkPayload;
    struct UplinkData; 

    class Manager
    {
    public:
        /**
         * @brief Initialize the LoRaWAN manager.
         *
         * Loads LoRaWAN credentials (keys) from non-volatile storage
         * and applies them to the underlying LoRaWAN device.
         *
         * @retval true  Keys successfully loaded and applied.
         * @retval false Failed to load keys.
         */
        explicit Manager( LorawanSensor & device, UplinkPayload & payload );

        bool setup();

        /**
         * @brief Encode and transmit an uplink payload.
         *
         * Encodes the provided uplink data using the configured
         * payload encoder and transmits it via the LoRaWAN device.
         *
         * @param[in] data Structured uplink data to transmit.
         *
         * @retval true  Payload successfully sent.
         * @retval false Encoding or transmission failed.
         *
         * @note A stack-allocated buffer sized to payload_.size()
         *       is used for encoding.
         * @note This function performs no retries.
         */
        bool sendUplink( const UplinkData & data );

    private:
        LorawanSensor & device_;
        UplinkPayload & payload_;
    };

} /* namespace lorawan */

#endif /* SRC_MODULES_LORAWAN_LORAWAN_MANAGER_HPP */
