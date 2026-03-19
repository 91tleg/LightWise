#include "th_task.hpp"

#include <freertos/task.h>

#include "types/th_data.hpp"
#include "th_manager.hpp"
#include "utils/log/log.h"

namespace th
{

    namespace
    {

        constexpr char kTag[] { "ThTask" };

    } /* anonymous namespace */

    void task( void *pvParameters )
    {
        configASSERT( pvParameters != nullptr );
    
        TaskParams &params { *static_cast< TaskParams * >( pvParameters ) };
    
        configASSERT( params.queue != nullptr );
    
        Data data {};
    
        for( ;; )
        {
            /* Block until upstream notifier signals a sample is ready. */
            ulTaskNotifyTake( pdTRUE, portMAX_DELAY );
    
            const bool updated { params.manager.update( data ) };
    
            if( updated )
            {
                LOGI( kTag, "Temperature: %.1d C, humidity: %.1d %%",
                      static_cast< int >( data.temperature ),
                      static_cast< int >( data.humidity ) );
            }
            else
            {
                LOGW( kTag, "Sensor update failed" );
            }
    
            const BaseType_t queueResult { xQueueSend( params.queue,
                                                       &data,
                                                       static_cast< TickType_t >( 0U ) ) };
            if( queueResult != pdTRUE )
            {
                LOGW( kTag, "Queue send failed: consumer may be slow" );
            }
        }
    }

} /* namespace th */
