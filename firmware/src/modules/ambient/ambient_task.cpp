#include "ambient_task.hpp"

#include <freertos/task.h>

#include "ambient_manager.hpp"
#include "utils/log.h"

namespace ambient
{
    namespace
    {
        constexpr char kTag[] = "AmbeintTask";
        constexpr float kAlpha = 0.1f; /* Smoothing factor for EMA filter */
        constexpr TickType_t kSamplePeriodMs = 30U * 1000U; /* 30 seconds */
    } /* anonymous namespace */

    void task( void * pvParameters )
    {
        TaskParams * const params =
            static_cast<TaskParams *>( pvParameters );
        configASSERT( params != nullptr );
        configASSERT( params->queue != nullptr );

        Manager mgr( params->primary,
                     params->secondary,
                     kAlpha );

        Data data{};
        TickType_t lastWakeTime = xTaskGetTickCount();

        for( ;; )
        {
            const bool updated = mgr.update( data );
            LOGI( kTag, "Ambient update %s: %.2f lux",
                  updated ? "success" : "failed", data.lux );

            const BaseType_t queueResult  = xQueueOverwrite( params->queue, &data );
            LOGI( kTag, "Data queue send %s", queueResult == pdTRUE ? "success" : "failed" );

            const BaseType_t delayResult = xTaskDelayUntil( &lastWakeTime,
                                                            pdMS_TO_TICKS( kSamplePeriodMs ) );
            LOGI( kTag, "Task delay %s", delayResult == pdTRUE ? "success" : "failed" );
        }
    }
} /* namespace ambient */
