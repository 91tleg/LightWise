#ifndef SRC_MODULES_TH_TH_TASK_HPP
#define SRC_MODULES_TH_TH_TASK_HPP

#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>

namespace th 
{
    class THSensor;

    /**
     * @brief Parameters passed to the task.
     *
     * This structure is provided to the task at creation via the pvParameters argument.
     */
    struct TaskParams
    {
        THSensor * primary;     /**< Pointer to the temperature/humidity sensor */
        QueueHandle_t queue;    /**< Queue used to publish Data samples */
    };

    /**
     * @brief FreeRTOS task for temperature/humidity sensor sampling.
     *
     * The task blocks on a task notification. When notified, it:
     *  - Reads the sensor
     *  - Applies EMA filtering
     *  - Publishes the result to a queue
     *
     * The queue is written to even if the sensor read fails.
     * The validity of the data is indicated by Data::health.
     *
     * @param[in] pvParameters Pointer to a TaskParams structure.
     */
    void task( void * pvParameters );

} /* namespace th */

#endif /* SRC_MODULES_TH_TH_TASK_HPP */
