#include "lorawan_task.hpp"

#include <freertos/task.h>

#include "keys.hpp"
#include "lib/lorawan/lorawan_sensor.hpp"
#include "payloads/uplink_payload.hpp"
#include "lorawan_manager.hpp"
#include "types/lorawan_data.hpp"
#include "utils/log.h"

namespace lorawan
{
    namespace
    {
        constexpr char kTag[] = "LoRaWANTask";
    } /* anonymous namespace */

    void task( void * pvParameters )
    {
        TaskParams * params =
            static_cast<TaskParams *>( pvParameters );
        configASSERT( params != nullptr );
        configASSERT( params->primary != nullptr );
        configASSERT( params->payload != nullptr );
        configASSERT( params->rxQueue != nullptr );
        
        Manager mgr( *params->primary, *params->payload );

        bool ok = mgr.setup();
        LOGI( kTag, "NVS key load: %d", static_cast<int>( ok ) );

        UplinkData data{};

        for( ;; )
        {
            const BaseType_t queueResult = xQueueReceive( params->rxQueue,
                                                          &data,
                                                          portMAX_DELAY );
            if( queueResult == pdTRUE )
            {
                LOGD( kTag, "Queue recieved" );
            }
            else
            {
                LOGW( kTag, "Failed to recieve queue" );
            }

            ok = mgr.sendUplink( data );
            LOGI( kTag, "Send uplink: %d", static_cast<int>( ok ) ); 
        }
    }
} /* namespace lorawan */
