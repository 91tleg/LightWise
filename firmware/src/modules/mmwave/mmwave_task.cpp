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
        constexpr uint8_t kFailureNotifyThreshold = 3U;
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
        uint8_t consecutiveFailures = 0U;

        const bool setupOk = mgr.setup();
        LOGI( kTag, "Setting up mmWave manager: %s", setupOk ? "success" : "failed" );

        for( ;; )
        {
            LOGI( kTag, "Updating mmWave manager" );
            const bool ok = mgr.update(data);
            LOGI( kTag, "Updating mmWave manager: %s", ok ? "success" : "failed" );

            if( data.motionDetected )
            {
                LOGI( kTag, "Motion detected" );
                LOGI( kTag, "Notifying FSM task" );
                const BaseType_t notifyResult = xTaskNotifyGive( params->fsmTaskHandle );
                LOGI( kTag, "Notifying FSM task: %s", notifyResult == pdPASS ? "success" : "failed" );
                
                LOGI( kTag, "Sending data to queue" );
                const BaseType_t queueResult = xQueueOverwrite( params->queue, &data );
                LOGI( kTag, "Sending data to queue: %s", queueResult == pdPASS ? "success" : "failed" );
            }

            vTaskDelay( pdMS_TO_TICKS( kTaskDelayMs ) );
        }
    }
} /* namespace mmwave */
