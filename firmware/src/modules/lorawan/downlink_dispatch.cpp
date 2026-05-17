#include "downlink_dispatch.hpp"

#include <algorithm>
#include <array>
#include <span>

#include "lorawan_manager.hpp"
#include "config/config_store.hpp"
#include "downlink_validators.hpp"
#include "payloads/acknack.hpp"
#include "common/system/system_control.h"
#include "common/utils/time/delay.h"
#include "common/types/lorawan_downlink.hpp"
#include "common/types/lorawan_response.hpp"
#include "common/types/fsm_event.hpp"
#include "utils/log/log.h"

namespace lorawan
{

    namespace
    {

        constexpr char kTag[] { "LoRaWANDispatch" };
        constexpr uint8_t kMaxAckRetries   { 3U   };
        constexpr uint32_t kAckRetryDelayMs{ 200U };

        void sendResponse( Manager & manager,
                           ResponseCode response,
                           DownlinkCmd cmd,
                           ReasonCode reason ) noexcept
        {
            std::array< uint8_t, payload::acknack::kSize > buf {};
            payload::acknack::encode( { response, cmd, reason }, buf );

            bool sent { false };
            for( uint8_t attempt { 0U };
                 ( attempt < kMaxAckRetries ) && !sent;
                 ++attempt )
            {
                sent = manager.send( buf );
                if( !sent && ( attempt < ( kMaxAckRetries - 1U ) ) )
                {
                    delay_ms( kAckRetryDelayMs );
                }
            }

            const bool isAck { response == ResponseCode::Ack };
            if( sent )
            {
                LOGI( kTag, "%s sent cmd=0x%02X reason=0x%02X",
                      isAck ? "ACK" : "NACK",
                      static_cast< unsigned >( cmd ),
                      static_cast< unsigned >( reason ) );
            }
            else
            {
                LOGE( kTag, "%s dropped cmd=0x%02X reason=0x%02X",
                      isAck ? "ACK" : "NACK",
                      static_cast< unsigned >( cmd ),
                      static_cast< unsigned >( reason ) );
            }
        }

        void sendAck( Manager & manager, DownlinkCmd cmd ) noexcept
        {
            sendResponse( manager, ResponseCode::Ack, cmd, ReasonCode::Ok );
        }

        void sendNack( Manager & manager, DownlinkCmd cmd, ReasonCode reason ) noexcept
        {
            sendResponse( manager, ResponseCode::Nack, cmd, reason );
        }

        void postToFsm( QueueHandle_t queue, const DownlinkEvent & ev ) noexcept
        {
            if( xQueueSend( queue, &ev, 0U ) != pdTRUE )
            {
                LOGW( kTag, "FSM cmd queue full — event dropped" );
            }
        }

        [[nodiscard]] bool persist( Manager & manager,
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

        void handleSetLevels( DispatchContext & ctx, const DownlinkPayload & pl ) noexcept
        {
            const auto r { validators::validateSetLevels( pl ) };

            if( !r.valid )
            {
                sendNack( ctx.manager, pl.cmd, r.reason );
            }
            else
            {
                ctx.config.maxLevel = r.max;
                ctx.config.dimLevel = r.dim;

                if( persist( ctx.manager, ctx.configStore, ctx.config, pl.cmd ) )
                {
                    sendAck( ctx.manager, pl.cmd );
                }
            }
        }

        void handleSetMotionTimeout( DispatchContext & ctx, const DownlinkPayload & pl ) noexcept
        {
            const auto r { validators::validateMotionTimeout( pl ) };

            if( !r.valid )
            {
                sendNack( ctx.manager, pl.cmd, r.reason );
            }
            else
            {
                ctx.config.motionTimeoutS = r.timeoutS;

                if( persist( ctx.manager, ctx.configStore, ctx.config, pl.cmd ) )
                {
                    sendAck( ctx.manager, pl.cmd );
                }
            }
        }

        void handleOverrideOn( DispatchContext & ctx, const DownlinkPayload & pl ) noexcept
        {
            const auto r { validators::validateOverrideOn( pl ) };

            if( !r.valid )
            {
                sendNack( ctx.manager, pl.cmd, r.reason );
            }
            else
            {
                DownlinkEvent ev {};
                ev.event              = fsm::Event::LoraOverrideOn;
                ev.data.overrideLevel = r.level;
                postToFsm( ctx.fsmCmdQueue, ev );
                sendAck( ctx.manager, pl.cmd );
            }
        }

        void handleOverrideOff( DispatchContext & ctx, const DownlinkPayload & pl ) noexcept
        {
            static_cast< void >( pl );
            postToFsm( ctx.fsmCmdQueue, { fsm::Event::LoraOverrideOff, {} } );
            sendAck( ctx.manager, pl.cmd );
        }

        void handleResumeAuto( DispatchContext & ctx, const DownlinkPayload & pl ) noexcept
        {
            static_cast< void >( pl );
            postToFsm( ctx.fsmCmdQueue, { fsm::Event::LoraResumeAuto, {} } );
            sendAck( ctx.manager, pl.cmd );
        }

        void handleRequestUplink( DispatchContext & ctx, const DownlinkPayload & pl ) noexcept
        {
            static_cast< void >( pl );
            /* TODO: post LoraRequestUplink FSM event so the uplink task
                     actually sends a status frame. Right now only ACK goes out. */
            sendAck( ctx.manager, pl.cmd );
        }

        void handleReboot( DispatchContext & ctx, const DownlinkPayload & pl ) noexcept
        {
            static_cast< void >( pl );
            sendAck( ctx.manager, pl.cmd );
            LOGI( kTag, "Rebooting command" );
            system_reboot();
        }

        void handleSetMotionSensitivity( DispatchContext & ctx, const DownlinkPayload & pl ) noexcept
        {
            const auto r { validators::validateMotionSensitivity( pl ) };

            if( !r.valid )
            {
                sendNack( ctx.manager, pl.cmd, r.reason );
            }
            else
            {
                ctx.config.motionSensitivity = r.sensitivity;

                if( persist( ctx.manager, ctx.configStore, ctx.config, pl.cmd ) )
                {
                    sendAck( ctx.manager, pl.cmd );
                }
            }
        }

        void handleSetHeartbeatInterval( DispatchContext & ctx, const DownlinkPayload & pl ) noexcept
        {
            const auto r { validators::validateHeartbeatInterval( pl ) };

            if( !r.valid )
            {
                sendNack( ctx.manager, pl.cmd, r.reason );
            }
            else
            {
                ctx.config.heartbeatMin = r.intervalMin;

                if( persist( ctx.manager, ctx.configStore, ctx.config, pl.cmd ) )
                {
                    sendAck( ctx.manager, pl.cmd );
                }
            }
        }

        void handleSetTempDim( DispatchContext & ctx, const DownlinkPayload & pl ) noexcept
        {
            const auto r { validators::validateTempDim( pl ) };

            if( !r.valid )
            {
                sendNack( ctx.manager, pl.cmd, r.reason );
            }
            else
            {
                DownlinkEvent ev {};
                ev.event              = fsm::Event::LoraTempDim;
                ev.data.overrideLevel = r.level;
                ev.data.tempDimHours  = r.hours;
                postToFsm( ctx.fsmCmdQueue, ev );
                sendAck( ctx.manager, pl.cmd );
            }
        }

    } /* anonymous namespace */

    void decodeAndDispatch( DispatchContext & ctx,
                            const uint8_t * rawPayload,
                            uint8_t len,
                            int8_t rssi,
                            int8_t snr ) noexcept
    {
        const std::span< const uint8_t > payload { rawPayload, len };

        LOGI( kTag, "Downlink len=%u rssi=%d snr=%d",
              static_cast< unsigned >( len ),
              static_cast< int >( rssi ),
              static_cast< int >( snr ) );

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
        }
        else
        {
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
                case DownlinkCmd::SetLevels:
                    handleSetLevels( ctx, pl );
                    break;

                case DownlinkCmd::SetMotionTimeout:
                    handleSetMotionTimeout( ctx, pl );
                    break;

                case DownlinkCmd::OverrideOn:
                    handleOverrideOn( ctx, pl );
                    break;

                case DownlinkCmd::OverrideOff:
                    handleOverrideOff( ctx, pl );
                    break;

                case DownlinkCmd::ResumeAuto:
                    handleResumeAuto( ctx, pl );
                    break;

                case DownlinkCmd::RequestUplink:
                    handleRequestUplink( ctx, pl );
                    break;

                case DownlinkCmd::Reboot:
                    handleReboot( ctx, pl );
                    break;

                case DownlinkCmd::SetMotionSensitivity:
                    handleSetMotionSensitivity( ctx, pl );
                    break;

                case DownlinkCmd::SetHeartbeatInterval:
                    handleSetHeartbeatInterval( ctx, pl );
                    break;

                case DownlinkCmd::SetTempDim:
                    handleSetTempDim( ctx, pl );
                    break;

                default:
                    LOGW( kTag, "Unknown cmd 0x%02X",
                          static_cast< unsigned >( payload[ 1U ] ) );
                    sendNack( ctx.manager, cmd, ReasonCode::InvalidCmd );
                    break;
            }
        }
    }

} /* namespace lorawan */
