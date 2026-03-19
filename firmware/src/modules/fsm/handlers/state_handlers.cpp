#include "state_handlers.hpp"
#include "utils/log/log.h"

namespace fsm
{

    namespace
    {

        constexpr char kTag[] { "StateHandler" };

        /* Determine auto state from current lux reading. */
        [[nodiscard]] State resolveAutoState( float lux ) noexcept
        {
            constexpr float kAmbientThreshold { 1000.0f };
            return ( lux <= kAmbientThreshold ) ? State::AutoDim : State::AutoOff;
        }

    } /* anonymous namespace */

    HandlerResult AutoOffHandler::process( Event event,
                                           const EventData & data,
                                           Config & config ) noexcept
    {
        HandlerResult result { State::AutoOff, false };

        switch( event )
        {
            case Event::PhotocellDark:
                result = { State::AutoDim, true };
                break;

            case Event::LoraOverrideOn:
                config.manualLevel = data.overrideLevel;
                result = { State::ManualOn, true };
                break;

            case Event::LoraOverrideOff:
                result = { State::ManualOff, true };
                break;

            case Event::LoraTempDim:
                config.tempDimLevel = data.overrideLevel;
                /* Stored — takes effect at dusk; stay in AutoOff */
                break;

            case Event::FaultDetected:
                result = { State::Fault, true };
                break;

            default:
                break;
        }

        return result;
    }

    HandlerResult AutoDimHandler::process( Event event,
                                           const EventData & data,
                                           Config & config ) noexcept
    {
        HandlerResult result { State::AutoDim, false };

        switch( event )
        {
            case Event::PhotocellLight:
                result = { State::AutoOff, true };
                break;

            case Event::MotionDetected:
                result = { State::MotionActive, true };
                break;

            case Event::LoraOverrideOn:
                config.manualLevel = data.overrideLevel;
                result = { State::ManualOn, true };
                break;

            case Event::LoraOverrideOff:
                result = { State::ManualOff, true };
                break;

            case Event::LoraTempDim:
                config.tempDimLevel = data.overrideLevel;
                result = { State::TempDim, true };
                break;

            case Event::FaultDetected:
                result = { State::Fault, true };
                break;

            default:
                break;
        }

        return result;
    }

    HandlerResult MotionActiveHandler::process( Event event,
                                                const EventData & data,
                                                Config & config ) noexcept
    {
        HandlerResult result { State::MotionActive, false };

        switch( event )
        {
            case Event::MotionDetected:
                /* Timer reset handled by task — stay in MotionActive. */
                break;

            case Event::MotionTimeout:
                result = { State::AutoDim, true };
                break;

            case Event::PhotocellLight:
                result = { State::AutoOff, true };
                break;

            case Event::LoraOverrideOn:
                config.manualLevel = data.overrideLevel;
                result = { State::ManualOn, true };
                break;

            case Event::LoraOverrideOff:
                result = { State::ManualOff, true };
                break;

            case Event::FaultDetected:
                result = { State::Fault, true };
                break;

            default:
                break;
        }

        /* Suppress unused warning — config read in LoraOverrideOn only. */
        static_cast< void >( data );

        return result;
    }

    HandlerResult ManualOnHandler::process( Event event,
                                            const EventData & data,
                                            Config & config ) noexcept
    {
        HandlerResult result { State::ManualOn, false };

        switch( event )
        {
            case Event::LoraResumeAuto:
                result = { resolveAutoState( data.lux ), true };
                break;

            case Event::ManualTimeout:
                LOGW( kTag, "ManualOn safety timeout — returning to AUTO" );
                result = { resolveAutoState( data.lux ), true };
                break;

            case Event::LoraOverrideOff:
                result = { State::ManualOff, true };
                break;

            case Event::FaultDetected:
                result = { State::Fault, true };
                break;

            default:
                break;
        }

        static_cast< void >( config );
        return result;
    }

    HandlerResult ManualOffHandler::process( Event event,
                                             const EventData & data,
                                             Config & config ) noexcept
    {
        HandlerResult result { State::ManualOff, false };

        switch( event )
        {
            case Event::LoraResumeAuto:
                result = { resolveAutoState( data.lux ), true };
                break;

            case Event::ManualTimeout:
                LOGW( kTag, "ManualOff safety timeout — returning to AUTO" );
                result = { resolveAutoState( data.lux ), true };
                break;

            case Event::LoraOverrideOn:
                config.manualLevel = data.overrideLevel;
                result = { State::ManualOn, true };
                break;

            case Event::FaultDetected:
                result = { State::Fault, true };
                break;

            default:
                break;
        }

        return result;
    }

    HandlerResult TempDimHandler::process( Event event,
                                           const EventData & data,
                                           Config & config ) noexcept
    {
        HandlerResult result { State::TempDim, false };

        switch( event )
        {
            case Event::MotionDetected:
                result = { State::MotionActive, true };
                break;

            case Event::TempDimExpiry:
                result = { State::AutoDim, true };
                break;

            case Event::PhotocellLight:
                result = { State::AutoOff, true };
                break;

            case Event::LoraOverrideOn:
                config.manualLevel = data.overrideLevel;
                result = { State::ManualOn, true };
                break;

            case Event::LoraOverrideOff:
                result = { State::ManualOff, true };
                break;

            case Event::LoraResumeAuto:
                result = { State::AutoDim, true };
                break;

            case Event::FaultDetected:
                result = { State::Fault, true };
                break;

            default:
                break;
        }

        return result;
    }

    HandlerResult FaultHandler::process( Event event,
                                         const EventData & data,
                                         Config & config ) noexcept
    {
        HandlerResult result { State::Fault, false };

        switch( event )
        {
            case Event::FaultCleared:
                LOGI( kTag, "Fault cleared — returning to AUTO" );
                result = { resolveAutoState( data.lux ), true };
                break;

            case Event::LoraOverrideOn:
                config.manualLevel = data.overrideLevel;
                result = { State::ManualOn, true };
                break;

            default:
                break;
        }

        return result;
    }

} /* namespace fsm */
