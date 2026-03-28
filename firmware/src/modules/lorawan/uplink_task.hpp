#ifndef SRC_MODULES_LORAWAN_UPLINK_TASK_HPP
#define SRC_MODULES_LORAWAN_UPLINK_TASK_HPP

#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>

namespace lorawan
{

    class Manager;

    /**
     * @brief Parameters passed to the task.
     *
     * This structure is provided to the task at creation via the pvParameters argument.
     */
    struct UplinkTaskParams
    {
        Manager & manager;     /**< Fully constructed, statically allocated Manager. */
        QueueHandle_t rxQueue; /**< Queue for receiving uplink data */
    };

    /**
     * @brief FreeRTOS task for packet formatting and sending uplink.
     *
     * Handles LoRaWAN uplink processing, including encoding payloads,
     * sending packet uplink.
     *
     * @param[in] pvParameters Pointer to a TaskParams structure.
     */
    void uplinkTask( void * pvParameters );

} /* namespace lorawan */

#endif /* SRC_MODULES_LORAWAN_UPLINK_TASK_HPP */
