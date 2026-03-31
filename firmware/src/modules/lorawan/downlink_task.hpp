#ifndef SRC_MODULES_LORAWAN_DOWNLINK_TASK_HPP
#define SRC_MODULES_LORAWAN_DOWNLINK_TASK_HPP

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

    struct DownlinkTaskParams
    {
        Manager & manager;                 /**< Fully constructed, statically allocated Manager. */
        config::ConfigStore & configStore; /**< Persistence. */
        config::SystemConfig & config;     /**< Live config reference */
        QueueHandle_t fsmCmdQueue;         /**< Queue sending DownlinkEvent to FSM task. */
    };

    /**
     * @brief  FreeRTOS FSM task — never returns.
     * @param  pvParameters  Pointer to a TaskParams instance (non-null).
     */
    void downlinkTask( void * pvParameters );

} /* namespace lorawan */

#endif /* SRC_MODULES_LORAWAN_DOWNLINK_TASK_HPP */
