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
        constexpr TickType_t kSamplePeriodMs = 60U * 1000U; /* 1 minute */
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
            LOGI( kTag, "Ambient update %d: %d.%02d",
                  static_cast<int>( updated ),
                  static_cast<int>( data.lux ),
                  static_cast<int>( ( data.lux - static_cast<int>( data.lux ) ) * 100 ) );

            const BaseType_t queueResult  = xQueueOverwrite( params->queue, &data );
            if( queueResult == pdTRUE )
            {
                LOGD( kTag, "Ambient data queued successfully" );
            }
            else
            {
                LOGW( kTag, "Failed to queue ambient data" );
            }

            const BaseType_t delayResult = xTaskDelayUntil( &lastWakeTime,
                                                            pdMS_TO_TICKS( kSamplePeriodMs ) );
            if( delayResult == pdTRUE )
            {
                LOGD( kTag, "Task delayed successfully" );
            }
            else
            {
                LOGW( kTag, "Task delay failed" );
            }
        }
    }
} /* namespace ambient */
