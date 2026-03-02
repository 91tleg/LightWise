#ifndef SRC_MODULES_LIGHT_LIGHT_TASK_HPP
#define SRC_MODULES_LIGHT_LIGHT_TASK_HPP

#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>

#include "lib/light/light_sensor.hpp"

namespace light
{
    class LightSensor;

    /**
     * @struct TaskParams
     * @brief Parameters for initializing the light task.
     */
    struct TaskParams
    {
        LightSensor * primary;  /**< Pointer to the primary led */
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
