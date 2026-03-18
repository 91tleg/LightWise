#ifndef SRC_MODULES_MMWAVE_MMWAVE_TASK_HPP
#define SRC_MODULES_MMWAVE_MMWAVE_TASK_HPP

#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>
#include <freertos/task.h>

namespace mmwave
{
    class Manager;
    /**
     * @brief Parameters passed to the mmwave sensor task.
     *
     * This structure is provided to the task at creation time via
     * the pvParameters argument.
     */
    struct TaskParams
    {
        Manager & manager;          /**< Fully constructed, statically allocated Manager. */
        QueueHandle_t queue;        /**< Queue for publishing mmwave::Data to consumers.  */
        TaskHandle_t fsmTaskHandle; /**< FSM task to notify on motion edge.               */
    };

    /**
     * @brief FreeRTOS task function for motion detection.
     *
     * @param pvParameters Pointer to an MmwaveTaskParams struct.
     *
     * The task runs indefinitely, sending one MmwaveData struct per sampling period.
     * The queue is written to even if the sensor read fails.
     * The validity of the data is indicated by MmwaveData::health.
     */
    void task( void * pvParameters );

} /* namespace mmwave */

#endif /* SRC_MODULES_MMWAVE_MMWAVE_TASK_HPP */
