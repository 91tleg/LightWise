#ifndef SRC_MODULES_FSM_FSM_TASK_HPP
#define SRC_MODULES_FSM_FSM_TASK_HPP

#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>
#include <freertos/task.h>

namespace fsm
{
    class Manager;

    struct TaskParams
    {
        Manager & manager;            /**< Fully constructed FSM Manager.   */
        QueueHandle_t ambientRxQueue; /**< Receives ambient::Data.          */
        QueueHandle_t thRxQueue;      /**< Receives th::Data.               */
        QueueHandle_t mmwaveRxQueue;  /**< Receives mmwave::Data.           */
        QueueHandle_t lorawanTxQueue; /**< Sends lorawan::UplinkData.       */
        QueueHandle_t fsmCmdQueue;    /**< Receives lorawan::DownlinkEvent. */
        QueueHandle_t ledPresentQueue ;
        TaskHandle_t thTaskHandle;    /**< Notified to trigger a TH sample. */
        TaskHandle_t lightTaskHandle; /**< Notified with new light level.   */
    };

    /**
     * @brief  FreeRTOS FSM task — never returns.
     * @param  pvParameters  Pointer to a TaskParams instance (non-null).
     */
    void task( void * pvParameters );

} /* namespace fsm */

#endif /* SRC_MODULES_FSM_FSM_TASK_HPP */
