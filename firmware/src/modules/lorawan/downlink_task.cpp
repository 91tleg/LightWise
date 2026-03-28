#include "downlink_task.hpp"

#include <algorithm>
#include <array>
#include <span>

#include <freertos/task.h>
#include <esp_system.h>

#include "lorawan_manager.hpp"
#include "payloads/acknack.hpp"
#include "types/lorawan_downlink.hpp"
#include "types/lorawan_response.hpp"
#include "types/fsm_event.hpp"
#include "config/config_store.hpp"
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
            portYIELD_FROM_ISR( xHigherPriorityTaskWoken );
        }

        void sendAck( Manager & manager, DownlinkCmd cmd ) noexcept
        {
            std::array< uint8_t, payload::acknack::kSize > buf {};
            payload::acknack::encode( { ResponseCode::Ack, cmd, ReasonCode::Ok }, buf );
            static_cast< void >( manager.send( buf ) );
            LOGI( kTag, "ACK cmd=0x%02X", static_cast< unsigned >( cmd ) );
        }

        void sendNack( Manager & manager, DownlinkCmd cmd, ReasonCode reason ) noexcept
        {
            std::array< uint8_t, payload::acknack::kSize > buf {};
            payload::acknack::encode( { ResponseCode::Nack, cmd, reason }, buf );
            static_cast< void >( manager.send( buf ) );
            LOGW( kTag, "NACK cmd=0x%02X reason=0x%02X",
                  static_cast< unsigned >( cmd ),
                  static_cast< unsigned >( reason ) );
        }

        static void postToFsm( QueueHandle_t queue, const DownlinkEvent & ev ) noexcept
        {
            if( xQueueSend( queue, &ev, 0U ) != pdTRUE )
            {
                LOGW( kTag, "FSM cmd queue full — event dropped" );
            }
        }

        [[nodiscard]] static bool persist( Manager & manager,
                                           config::ConfigStore & store,
                                           config::SystemConfig & config,
                                           DownlinkCmd cmd ) noexcept
        {
            const bool ok { store.save( config ) };
            if( !ok )
            {
                sendNack( manager, cmd, ReasonCode::NvsError );
            }
            return ok;
        }

        struct Context
        {
            Manager & manager;
            config::ConfigStore & configStore;
            QueueHandle_t fsmCmdQueue;
            config::SystemConfig & config;
        };

        void handleSetLevels( Context & ctx, const DownlinkPayload & pl ) noexcept
        {
            const bool valid  { pl.paramLen >= 2U };
            const uint8_t max { static_cast< uint8_t >( valid ? pl.params[ 0U ] : 0U ) };
            const uint8_t dim { static_cast< uint8_t >( valid ? pl.params[ 1U ] : 0U ) };
            const bool validRange { valid && ( max >= 1U ) && ( max <= 100U ) &&
                                    ( dim <= 100U ) && ( dim <= max ) };

            if( !valid || !validRange )
            {
                sendNack( ctx.manager, pl.cmd, ReasonCode::InvalidParam );
            }
            else
            {
                ctx.config.maxLevel = max;
                ctx.config.dimLevel = dim;

                if( persist( ctx.manager, ctx.configStore, ctx.config, pl.cmd ) )
                {
                    sendAck( ctx.manager, pl.cmd );
                }
            }
        }

        void handleSetMotionTimeout( Context & ctx, const DownlinkPayload & pl ) noexcept
        {
            const bool valid { pl.paramLen >= 2U };

            if( !valid )
            {
                sendNack( ctx.manager, pl.cmd, ReasonCode::InvalidParam );
            }
            else
            {
                const uint16_t timeout { static_cast< uint16_t >(
                    ( static_cast< uint16_t >( pl.params[ 0U ] ) << 8U ) |
                    static_cast< uint16_t >( pl.params[ 1U ] ) ) };

                const bool validRange { ( timeout >= 15U ) && ( timeout <= 3600U ) };

                if( !validRange )
                {
                    sendNack( ctx.manager, pl.cmd, ReasonCode::InvalidParam );
                }
                else
                {
                    ctx.config.motionTimeoutS = timeout;

                    if( persist( ctx.manager, ctx.configStore, ctx.config, pl.cmd ) )
                    {
                        sendAck( ctx.manager, pl.cmd );
                    }
                }
            }
        }

        void handleOverrideOn( Context & ctx, const DownlinkPayload & pl ) noexcept
        {
            const bool valid      { pl.paramLen >= 1U };
            const uint8_t level   { static_cast< uint8_t >( valid ? pl.params[ 0U ] : 0U ) };
            const bool validRange { valid && ( level >= 1U ) && ( level <= 100U ) };

            if( !valid || !validRange )
            {
                sendNack( ctx.manager, pl.cmd, ReasonCode::InvalidParam );
            }
            else
            {
                DownlinkEvent ev {};
                ev.event              = fsm::Event::LoraOverrideOn;
                ev.data.overrideLevel = level;
                postToFsm( ctx.fsmCmdQueue, ev );
                sendAck( ctx.manager, pl.cmd );
            }
        }

        void handleOverrideOff( Context & ctx, const DownlinkPayload & pl ) noexcept
        {
            static_cast< void >( pl );
            postToFsm( ctx.fsmCmdQueue, { fsm::Event::LoraOverrideOff, {} } );
            sendAck( ctx.manager, pl.cmd );
        }

        void handleResumeAuto( Context & ctx, const DownlinkPayload & pl ) noexcept
        {
            static_cast< void >( pl );
            postToFsm( ctx.fsmCmdQueue, { fsm::Event::LoraResumeAuto, {} } );
            sendAck( ctx.manager, pl.cmd );
        }

        void handleRequestUplink( Context & ctx, const DownlinkPayload & pl ) noexcept
        {
            static_cast< void >( pl );
            sendAck( ctx.manager, pl.cmd );
        }

        void handleReboot( Context & ctx, const DownlinkPayload & pl ) noexcept
        {
            static_cast< void >( pl );
            sendAck( ctx.manager, pl.cmd );
            LOGI( kTag, "Rebooting on remote command" );
            esp_restart();
        }

        void handleSetMotionSensitivity( Context & ctx, const DownlinkPayload & pl ) noexcept
        {
            const bool valid          { pl.paramLen >= 1U };
            const uint8_t sensitivity { static_cast< uint8_t >( valid ? pl.params[ 0U ] : 0U ) };
            const bool validRange     { valid && ( sensitivity >= 1U ) && ( sensitivity <= 10U ) };

            if( !valid || !validRange )
            {
                sendNack( ctx.manager, pl.cmd, ReasonCode::InvalidParam );
            }
            else
            {
                ctx.config.motionSensitivity = sensitivity;

                if( persist( ctx.manager, ctx.configStore, ctx.config, pl.cmd ) )
                {
                    sendAck( ctx.manager, pl.cmd );
                }
            }
        }

        void handleSetHeartbeatInterval( Context & ctx, const DownlinkPayload & pl ) noexcept
        {
            const bool valid { pl.paramLen >= 1U };

            if( !valid )
            {
                sendNack( ctx.manager, pl.cmd, ReasonCode::InvalidParam );
            }
            else
            {
                ctx.config.heartbeatMin = pl.params[ 0U ];

                if( persist( ctx.manager, ctx.configStore, ctx.config, pl.cmd ) )
                {
                    sendAck( ctx.manager, pl.cmd );
                }
            }
        }

        void handleSetTempDim( Context & ctx, const DownlinkPayload & pl ) noexcept
        {
            const bool valid      { pl.paramLen >= 2U };
            const uint8_t level   { static_cast< uint8_t >( valid ? pl.params[ 0U ] : 0U ) };
            const uint8_t hours   { static_cast< uint8_t >( valid ? pl.params[ 1U ] : 0U ) };
            const bool validRange { valid && ( level <= 100U ) &&
                                    ( hours >= 1U ) && ( hours <= 24U ) };

            if( !valid || !validRange )
            {
                sendNack( ctx.manager, pl.cmd, ReasonCode::InvalidParam );
            }
            else
            {
                DownlinkEvent ev {};
                ev.event              = fsm::Event::LoraTempDim;
                ev.data.overrideLevel = level;
                ev.data.tempDimHours  = hours;
                postToFsm( ctx.fsmCmdQueue, ev );
                sendAck( ctx.manager, pl.cmd );
            }
        }

        void decodeAndDispatch( Context & ctx, const RxMessage & msg ) noexcept
        {
            const std::span< const uint8_t > payload { msg.payload.data(),
                                                       msg.payload.data() + msg.len };

            LOGI( kTag, "Downlink len=%u rssi=%d snr=%d",
                  static_cast< unsigned >( msg.len ),
                  static_cast< int >( msg.rssi ),
                  static_cast< int >( msg.snr ) );

            const bool validHeader { ( !payload.empty() ) &&
                                     ( payload.size() >= kDownlinkMinLen ) &&
                                     ( payload[ 0U ] == kDownlinkVersion ) };

            if( !validHeader )
            {
                const ReasonCode reason {
                    ( payload.size() < kDownlinkMinLen )
                        ? ReasonCode::PayloadTooShort
                        : ReasonCode::InvalidVersion };
                sendNack( ctx.manager, DownlinkCmd::ResumeAuto, reason );
                return;
            }

            const DownlinkCmd cmd { static_cast< DownlinkCmd >( payload[ 1U ] ) };

            DownlinkPayload pl {};
            pl.version  = payload[ 0U ];
            pl.cmd      = cmd;
            pl.paramLen = static_cast< uint8_t >(
                ( payload.size() > kDownlinkMinLen )
                    ? std::min( static_cast< uint8_t >( payload.size() - kDownlinkMinLen ),
                                kDownlinkMaxParams )
                    : 0U );

            for( uint8_t i { 0U }; i < pl.paramLen; ++i )
            {
                pl.params[ i ] = payload[ kDownlinkMinLen + i ];
            }

            switch( cmd )
            {
                case DownlinkCmd::SetLevels:            handleSetLevels( ctx, pl );            break;
                case DownlinkCmd::SetMotionTimeout:     handleSetMotionTimeout( ctx, pl );     break;
                case DownlinkCmd::OverrideOn:           handleOverrideOn( ctx, pl );           break;
                case DownlinkCmd::OverrideOff:          handleOverrideOff( ctx, pl );          break;
                case DownlinkCmd::ResumeAuto:           handleResumeAuto( ctx, pl );           break;
                case DownlinkCmd::RequestUplink:        handleRequestUplink( ctx, pl );        break;
                case DownlinkCmd::Reboot:               handleReboot( ctx, pl );               break;
                case DownlinkCmd::SetMotionSensitivity: handleSetMotionSensitivity( ctx, pl ); break;
                case DownlinkCmd::SetHeartbeatInterval: handleSetHeartbeatInterval( ctx, pl ); break;
                case DownlinkCmd::SetTempDim:           handleSetTempDim( ctx, pl );           break;
                default:
                    LOGW( kTag, "Unknown cmd 0x%02X",
                          static_cast< unsigned >( payload[ 1U ] ) );
                    sendNack( ctx.manager, cmd, ReasonCode::InvalidCmd );
                    break;
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

        config::SystemConfig config {};
        static_cast< void >( params.configStore.load( config ) );

        Context ctx
        {
            params.manager,
            params.configStore,
            params.fsmCmdQueue,
            config
        };

        /* Wait for join before accepting downlinks — no point to receive
         * commands since we cannot ACK/NACK until the network is ready.    */
        while( !params.manager.isReady() )
        {
            vTaskDelay( pdMS_TO_TICKS( 1000U ) );
        }
        params.manager.setRxCb( onReceive );

        for( ;; )
        {
            RxMessage msg {};
            if( xQueueReceive( sRxQueue, &msg, portMAX_DELAY ) == pdTRUE )
            {
                decodeAndDispatch( ctx, msg );
            }
        }
    }

} /* namespace lorawan */
