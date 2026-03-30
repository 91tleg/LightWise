#include "uplink_task.hpp"

#include <freertos/task.h>

#include "lorawan_manager.hpp"
#include "types/lorawan_uplink.hpp"
#include "payloads/v1.hpp"
#include "payloads/heartbeat.hpp"
#include "config/config_store.hpp"
#include "utils/log/log.h"

namespace lorawan
{

    namespace
    {

        constexpr char kTag[] { "LoRaWANUplinkTask" };
        constexpr uint8_t  kMaxRetries   { 3U    };
        constexpr uint32_t kRetryDelayMs { 500U  };
        constexpr uint32_t kJoinPollMs   { 1000U };

        void waitForJoin( Manager & manager ) noexcept
        {
            while( !manager.isReady() )
            {
                const uint32_t nowMs {
                    static_cast< uint32_t >( xTaskGetTickCount() * portTICK_PERIOD_MS )
                };
                static_cast< void >( manager.tryAdvanceJoin( nowMs ) );
                vTaskDelay( pdMS_TO_TICKS( kJoinPollMs ) );
            }
            LOGI( kTag, "Network ready: starting uplink loop" );
        }

        void sendTelemetry( Manager & manager,
                            const UplinkData & data ) noexcept
        {
            std::array< uint8_t, payload::v1::kSize > buf {};
            payload::v1::encode( data, buf );
            bool sent { false };

            for( uint8_t attempt { 0U };
                 ( attempt < kMaxRetries ) && !sent;
                 ++attempt )
            {
                sent = manager.send( buf );

                if( sent )
                {
                    LOGI( kTag, "Uplink sent (attempt %u)",
                          static_cast< unsigned >( attempt + 1U ) );
                }
                else
                {
                    LOGW( kTag, "Uplink failed (attempt %u/%u)",
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
                LOGE( kTag, "Uplink dropped after %u attempts",
                      static_cast< unsigned >( kMaxRetries ) );
            }
        }

        void sendHeartbeat( Manager & manager ) noexcept
        {
            std::array< uint8_t, payload::heartbeat::kSize > buf {};
            payload::heartbeat::encode( buf );
            bool sent { false };

            for( uint8_t attempt { 0U };
                 ( attempt < kMaxRetries ) && !sent;
                 ++attempt )
            {
                sent = manager.send( buf );
                if( !sent && ( attempt < ( kMaxRetries - 1U ) ) )
                {
                    vTaskDelay( pdMS_TO_TICKS( kRetryDelayMs ) );
                }
            }

            if( sent )
            {
                LOGI( kTag, "Heartbeat sent" );
            }
            else
            {
                LOGE( kTag, "Heartbeat dropped after %u attempts",
                            static_cast< unsigned >( kMaxRetries ) );
            }
        }

    } /* anonymous namespace */

    void uplinkTask( void * pvParameters )
    {
        configASSERT( pvParameters != nullptr );
        UplinkTaskParams & params { *static_cast< UplinkTaskParams * >( pvParameters ) };
        configASSERT( params.rxQueue != nullptr );

        waitForJoin( params.manager );

        for( ;; )
        {
            UplinkData data {};

            /* In the loop since config can change at runtime. */
            const TickType_t heartbeatTicks {
                pdMS_TO_TICKS( static_cast< uint32_t >( params.config.heartbeatMin ) * 60UL * 1000UL )
            };

            if( xQueueReceive( params.rxQueue, &data, heartbeatTicks ) == pdTRUE )
            {
                sendTelemetry( params.manager, data );
            }
            else
            {
                /* Timeout — no telemetry in heartbeat window */
                sendHeartbeat( params.manager );
            }
        }
    }

} /* namespace lorawan */
