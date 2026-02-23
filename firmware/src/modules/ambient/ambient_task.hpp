#ifndef SRC_MODULES_AMBIENT_AMBIENT_TASK_HPP
#define SRC_MODULES_AMBIENT_AMBIENT_TASK_HPP

#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>



namespace ambient
{
    class AmbientSensor;
    /**
     * @brief Parameters passed to the ambient sensor task.
     *
     * This structure is provided to the task at creation time 
     * via the pvParameters argument.
     */
    struct TaskParams
    {
        AmbientSensor * primary;   /**< Pointer to the primary ALS PT19 device */
        AmbientSensor * secondary; /**< Pointer to the secondary ALS PT19 device */
        QueueHandle_t queue;       /**< FreeRTOS queue to send AmbientData results */
    };

    /**
     * @brief FreeRTOS task function to periodically read ambient light sensors,
     *        apply filtering (EMA), and push the results to a queue.
     *
     * @param pvParameters Pointer to an TaskParams struct.
     *
     * The task runs indefinitely, sending one AmbientData struct per sampling period.
     * The queue is written to even if the sensor read fails.
     * The validity of the data is indicated by AmbientData::health.
     */
    void task( void * pvParameters );
} /* namespace ambient */

#endif /* SRC_MODULES_AMBIENT_AMBIENT_TASK_HPP */
