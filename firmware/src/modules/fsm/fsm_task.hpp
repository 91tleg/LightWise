#ifndef SRC_MODULES_FSM_FSM_TASK_HPP
#define SRC_MODULES_FSM_FSM_TASK_HPP

#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>

namespace fsm
{
    /**
     * @brief Parameters passed to the task.
     *
     * This structure is provided to the task at creation via the pvParameters argument.
     */
    struct TaskParams
    {
        QueueHandle_t ambeintRxQueue;  /**< Receieve ambient data periodically */
        TaskHandle_t  thTaskHandle;    /**< Need this to notify dht to send data */
        QueueHandle_t thRxQueue;       /**< Dht data queue after we request it */
        QueueHandle_t lorawanTxQueue;  /**< Send this queue out when event to send uplink */
        QueueHandle_t mmwaveRxQueue;   /**< Received when motion is detected */
        TaskHandle_t lightTaskHandle;  /**< Send light command */
    };

    /**
     * @brief FreeRTOS task for decision making and prepare uplink
     *
     * @param[in] pvParameters Pointer to a TaskParams structure.
     */
    void task( void * pvParameters );

} /* namespace fsm */

#endif /* SRC_MODULES_FSM_FSM_TASK_HPP */
