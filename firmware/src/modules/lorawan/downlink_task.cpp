#include "downlink_task.hpp"

#include <array>

#include <freertos/task.h>

#include "lorawan_manager.hpp"
#include "downlink_dispatch.hpp"
#include "utils/log/log.h"

namespace lorawan
{

    namespace
    {

        constexpr char kTag[] { "LoRaWANDownlinkTask" };
        constexpr uint8_t kDownlinkMaxPayload { 16U };

        struct RxMessage
        {
            std::array< uint8_t, kDownlinkMaxPayload > payload {};
            uint8_t len  { 0U };
            int8_t  rssi { 0  };
            int8_t  snr  { 0  };
        };

        StaticQueue_t sRxQueueBuffer {};
        RxMessage     sRxQueueStorage[ 4U ] {};
        QueueHandle_t sRxQueue { nullptr };

        void onReceive( const uint8_t * payload,
                        uint8_t len,
                        int8_t rssi,
                        int8_t snr ) noexcept
        {
            RxMessage msg {};
            msg.len  = std::min( len, kDownlinkMaxPayload );
            msg.rssi = rssi;
            msg.snr  = snr;
            static_cast< void >( std::copy( payload,
                                            payload + msg.len,
                                            msg.payload.begin() ) );

            BaseType_t xHigherPriorityTaskWoken { pdFALSE };
            xQueueSendFromISR( sRxQueue, &msg, &xHigherPriorityTaskWoken );
            if( xHigherPriorityTaskWoken == pdTRUE )
            {
                portYIELD_FROM_ISR();
            }
        }

    } /* anonymous namespace */

    void downlinkTask( void * pvParameters )
    {
        configASSERT( pvParameters != nullptr );
        DownlinkTaskParams & params { *static_cast< DownlinkTaskParams * >( pvParameters ) };
        configASSERT( params.fsmCmdQueue != nullptr );

        sRxQueue = xQueueCreateStatic( 4U,
                                       sizeof( RxMessage ),
                                       reinterpret_cast< uint8_t * >( sRxQueueStorage ),
                                       &sRxQueueBuffer );
        configASSERT( sRxQueue != nullptr );

        /* Wait for join before accepting downlinks — no point to receive
         * commands since we cannot ACK/NACK until the network is ready.    */
        while( !params.manager.isReady() )
        {
            vTaskDelay( pdMS_TO_TICKS( 1000U ) );
        }
        params.manager.setRxCb( onReceive );

        DispatchContext ctx { params.manager,
                              params.configStore,
                              params.fsmCmdQueue,
                              params.config };

        for( ;; )
        {
            RxMessage msg {};
            if( xQueueReceive( sRxQueue, &msg, portMAX_DELAY ) == pdTRUE )
            {
                LOGI( kTag, "Downlink recieved" );
                decodeAndDispatch( ctx,
                                   msg.payload.data(),
                                   msg.len,
                                   msg.rssi,
                                   msg.snr );
            }
        }
    }

} /* namespace lorawan */
