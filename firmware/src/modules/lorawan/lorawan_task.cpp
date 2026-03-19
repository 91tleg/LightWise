#include "lorawan_task.hpp"

#include <freertos/task.h>

#include "lib/lorawan/lorawan_sensor.hpp"
#include "payloads/uplink_payload.hpp"
#include "lorawan_manager.hpp"
#include "types/lorawan_data.hpp"
#include "utils/log/log.h"

namespace lorawan
{

    namespace
    {

        constexpr char kTag[] { "LoRaWANUplinkTask" };
        constexpr uint8_t  kMaxRetries     { 3U    };
        constexpr uint32_t kRetryDelayMs   { 500U  };
        constexpr uint32_t kJoinPollMs     { 1000U };
        constexpr uint32_t kDownlinkPollMs { 2000U };

    } /* anonymous namespace */

    void uplink_task( void * pvParameters )
    {
        configASSERT( pvParameters != nullptr );

        UplinkTaskParams &params { *static_cast< UplinkTaskParams * >( pvParameters ) };

        configASSERT( params.rxQueue != nullptr );

        while( !params.manager.isReady() )
        {
            const uint32_t nowMs { xTaskGetTickCount() * portTICK_PERIOD_MS };

            static_cast< void >( params.manager.tryAdvanceJoin( nowMs ) );

            vTaskDelay( pdMS_TO_TICKS( kJoinPollMs ) );
        }

        LOGI( kTag, "Network ready: starting uplink loop" );

        UplinkData data {};

        for( ;; )
        {
            if( xQueueReceive( params.rxQueue, &data, portMAX_DELAY ) == pdTRUE )
            {
                LOGD( kTag, "Queue received" );

                bool sent { false };

                for( uint8_t attempt { 0U };
                     ( attempt < kMaxRetries ) && !sent;
                     ++attempt )
                {
                    sent = params.manager.sendUplink( data );

                    if( sent )
                    {
                        LOGI( kTag, "Send uplink: success (attempt %u)",
                              static_cast< unsigned >( attempt + 1U ) );
                    }
                    else
                    {
                        LOGW( kTag, "Send uplink failed (attempt %u/%u)",
                              static_cast< unsigned >( attempt + 1U ),
                              static_cast< unsigned >( kMaxRetries ) );

                        if( attempt < ( kMaxRetries - 1U ) )
                        {
                            vTaskDelay( pdMS_TO_TICKS( kRetryDelayMs ) );
                        }
                    }
                }

                if( !sent )
                {
                    LOGE( kTag, "Send uplink failed after %u attempts — dropping packet",
                          static_cast< unsigned >( kMaxRetries ) );
                }
            }
            else
            {
                LOGW( kTag, "Failed to receive from queue" );
            }
        }
    }

} /* namespace lorawan */
