#include "ambient_task.hpp"

#include <freertos/task.h>

#include "ambient_manager.hpp"
#include "utils/log/log.h"

namespace ambient
{

    namespace
    {

        constexpr char kTag[] { "AmbientTask" };
        constexpr TickType_t kSamplePeriodMs { 30U * 1000U }; /* 30 seconds */

    } /* anonymous namespace */

    void task( void * pvParameters )
    {
        configASSERT( pvParameters != nullptr );
        TaskParams &params { *static_cast< TaskParams * >( pvParameters ) };
        configASSERT( params.queue != nullptr );

        Data data {};
        TickType_t lastWakeTime { xTaskGetTickCount() };

        for( ;; )
        {
            const bool updated { params.manager.update( data ) };
            LOGI( kTag, "Ambient update %s: %.2f lux",
                  updated ? "success" : "failed",
                  static_cast< double >( data.lux ) );

            const BaseType_t queueResult { xQueueOverwrite( params.queue, &data ) };
            LOGI( kTag, "Data queue send %s",
                  queueResult == pdTRUE ? "success" : "failed" );

            static_cast< void >( xTaskDelayUntil(
                                 &lastWakeTime,
                                 pdMS_TO_TICKS( kSamplePeriodMs ) ) );

        }
    }

} /* namespace ambient */
