#include "ambient_task.hpp"

#include <freertos/task.h>

#include "ambient_manager.hpp"

namespace ambient
{
    namespace
    {
        /* Smoothing factor for EMA filter */
        constexpr float kAlpha = 0.1f; 

        /* Sample period in milliseconds (1 minute) */
        constexpr TickType_t kSamplePeriodMs = 60U * 1000U;
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

        for( ;; )
        {
            bool updated = mgr.update( data );
            ( void ) updated;

            BaseType_t queueResult = xQueueOverwrite( params->queue, &data );
            ( void ) queueResult;

            vTaskDelay( pdMS_TO_TICKS( kSamplePeriodMs ) );
        }
    }
} /* namespace ambient */
