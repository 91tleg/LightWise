#ifndef SRC_MODULES_AMBIENT_AMBIENT_TASK_HPP
#define SRC_MODULES_AMBIENT_AMBIENT_TASK_HPP

#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>

namespace ambient
{

    class Manager;
    /**
     * @brief  Parameters injected into the ambient task at creation time.
     *
     * All members must be valid for the entire lifetime of the task.
     * Pass a pointer to a statically allocated instance via pvParameters.
     */
    struct TaskParams
    {
        Manager & manager;   /**< Fully constructed, statically allocated Manager. */
        QueueHandle_t queue; /**< Queue for publishing ambient::Data to consumer.  */
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
