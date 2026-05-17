#ifndef SRC_MODULES_LORAWAN_DOWNLINK_DISPATCH_HPP
#define SRC_MODULES_LORAWAN_DOWNLINK_DISPATCH_HPP

#include <cstdint>

#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>

namespace config
{
    struct SystemConfig;
    class ConfigStore;
}

namespace lorawan
{
    class Manager;

    struct DispatchContext
    {
        Manager & manager;
        config::ConfigStore & configStore;
        QueueHandle_t fsmCmdQueue;
        config::SystemConfig & config;
    };

    /**
     * Decode a raw downlink frame and dispatch to the appropriate handler.
     * Sends ACK or NACK via manager, posts FSM events via fsmCmdQueue.
     */
    void decodeAndDispatch( DispatchContext & ctx,
                            const uint8_t * payload,
                            uint8_t len,
                            int8_t rssi,
                            int8_t snr ) noexcept;

} /* namespace lorawan */

#endif /* SRC_MODULES_LORAWAN_DOWNLINK_DISPATCH_HPP */
