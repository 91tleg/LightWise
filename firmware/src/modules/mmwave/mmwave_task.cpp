#include "mmwave_task.hpp"

#include "types/mmwave_data.hpp"
#include "mmwave_manager.hpp"
#include "utils/log/log.h"

namespace mmwave
{

    namespace
    {

        constexpr char kTag[] { "MmwaveTask" };
        constexpr uint32_t kTaskPollMs { 200U };

    } /* anaonymous namespace */

    void task( void * pvParameters )
    {
        configASSERT( pvParameters != nullptr );

        TaskParams & params { *static_cast< TaskParams * >( pvParameters ) };

        configASSERT( params.queue         != nullptr );
        configASSERT( params.fsmTaskHandle != nullptr );

        Data data {};
        bool prevMotion { false };

        for( ;; )
        {
            const bool ok { params.manager.update( data ) };

            LOGD( kTag, "Update: %s", ok ? "success" : "failed" );

            const bool risingEdge  {  data.motionDetected && !prevMotion };
            const bool fallingEdge { !data.motionDetected &&  prevMotion };

            if( risingEdge || fallingEdge )
            {
                LOGI( kTag, "Motion %s", risingEdge ? "detected" : "gone" );

                const BaseType_t notifyResult { xTaskNotifyGive( params.fsmTaskHandle ) };

                LOGI( kTag, "Notify FSM: %s",
                      notifyResult == pdPASS ? "success" : "failed" );

                const BaseType_t queueResult { xQueueOverwrite( params.queue, &data ) };
    
                LOGI( kTag, "Queue send: %s",
                      queueResult == pdPASS ? "success" : "failed" );
            }
            prevMotion = data.motionDetected;

            vTaskDelay( pdMS_TO_TICKS( kTaskPollMs ) );
        }
    }

} /* namespace mmwave */
