#include "mmwave_task.hpp"

#include "lib/c4001.h"
#include "types/mmwave_data.hpp"
#include "mmwave_manager.hpp"
#include "utils/log.h"

namespace mmwave
{
    namespace
    {
        constexpr char kTag[] = "MmwaveTask";
        constexpr TickType_t kTaskDelayMs = 100UL;
    } /* anaonymous namespace */

    void task( void * pvParameters )
    {
        TaskParams * const params =
            static_cast<TaskParams *>( pvParameters );
        configASSERT( params != nullptr );
        configASSERT( params->queue != nullptr );
        configASSERT( params->fsmTaskHandle != nullptr );

        Manager mgr( params->primary,
                     params->secondary );

        Data data{};
        bool prevMotion = false;

        bool ok = mgr.setup();
        LOGI( kTag, "Setup: %s", ok ? "success" : "failed" );

        for( ;; )
        {
            ok = mgr.update(data);
            LOGI( kTag, "Update: %s", ok ? "success" : "failed" );

            const bool risingEdge = data.motionDetected && !prevMotion;

            if( risingEdge )
            {
                LOGI( kTag, "Motion detected" );
                const BaseType_t notifyResult = xTaskNotifyGive( params->fsmTaskHandle );
                LOGI( kTag, "Notify task: %s", notifyResult == pdPASS
                                               ? "success"
                                               : "failed" );
                
                const BaseType_t queueResult = xQueueOverwrite( params->queue, &data );
                LOGI( kTag, "Send queue: %s", queueResult == pdPASS
                                              ? "success"
                                              : "failed" );
            }
            prevMotion = data.motionDetected;

            vTaskDelay( pdMS_TO_TICKS( kTaskDelayMs ) );
        }
    }
} /* namespace mmwave */
