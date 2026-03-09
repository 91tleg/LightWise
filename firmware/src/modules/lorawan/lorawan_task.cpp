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
        constexpr uint8_t kMaxRetries = 3U;
        constexpr TickType_t kRetryDelayMs = pdMS_TO_TICKS( 500U );
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
        LOGI( kTag, "NVS key load: %s", ok ? "success" : "failed" );

        UplinkData data{};

        for( ;; )
        {
            const BaseType_t queueResult = xQueueReceive( params->rxQueue,
                                                          &data,
                                                          portMAX_DELAY );
            if( queueResult == pdTRUE )
            {
                LOGD( kTag, "Queue received" );

                for( uint8_t attempt = 0U; attempt < kMaxRetries; ++attempt )
                {
                    ok = mgr.sendUplink( data );
                    if( ok )
                    {
                        LOGI( kTag, "Send uplink: success (attempt %d)",
                              attempt + 1 );
                        break;
                    }

                    LOGW( kTag, "Send uplink failed (attempt %d/%d)",
                          attempt + 1, kMaxRetries );

                    if( attempt < ( kMaxRetries - 1U ) )
                    {
                        vTaskDelay( kRetryDelayMs );
                    }
                }

                if( !ok )
                {
                    LOGE( kTag, "Send uplink failed. Dropping packet" );
                }
            }
            else
            {
                LOGW( kTag, "Failed to receive queue" );
            }
        }
    }
} /* namespace lorawan */
