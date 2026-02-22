#include "th_task.hpp"

#include <freertos/task.h>

#include "types/th_data.hpp"
#include "th_manager.hpp"

namespace th
{
    namespace
    {
        constexpr float alpha = 0.1f;
    } /* anonymous namespace */

    void task( void * pvParameters )
    {
        TaskParams * const params = 
            static_cast<TaskParams * >( pvParameters );
        configASSERT( params != NULL );
        configASSERT( params->queue != NULL );

        Manager mgr( params->primary, alpha );

        Data data{};

        for( ;; )
        { 
            ulTaskNotifyTake( pdTRUE, portMAX_DELAY );

            ( void ) mgr.update( data );

            ( void ) xQueueSend( params->queue, 
                                 &data, 
                                 ( TickType_t ) 0UL );
        }
    }
} /* namespace th */
