#ifndef SRC_MODULES_LIGHT_LIGHT_TASK_HPP
#define SRC_MODULES_LIGHT_LIGHT_TASK_HPP

#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>

namespace light
{

    class Manager;

    /**
     * @brief  Parameters injected into the light task at creation time.
     *
     * All members must remain valid for the entire lifetime of the task.
     * Pass a pointer to a statically allocated instance via pvParameters.
     */
    struct TaskParams
    {
        Manager &manager;  /**< Fully constructed, statically allocated Manager. */
    };

    /**
     * @brief Light management task function for FreeRTOS.
     * 
     * This function runs as a FreeRTOS task and manages light sensor operations.
     * It receives parameters via a TaskParams structure passed through pvParameters.
     * The task communicates with other components via the queue defined in TaskParams.
     * 
     * @param pvParameters Pointer to a TaskParams structure containing task configuration.
     * 
     * @note This function should be passed to xTaskCreate() with the TaskParams
     *       structure as the parameter. The task runs indefinitely until deleted.
     */
    void task( void * pvParameters );

} /* namespace light */

#endif /* SRC_MODULES_LIGHT_LIGHT_TASK_HPP */
