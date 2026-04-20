#include "fsm_manager.hpp"

#include "types/fsm_event.hpp"
#include "utils/log/log.h"

namespace fsm
{

    namespace
    {

        constexpr char kTag[] { "FsmManager" };

    } /* anonymous namespace */

    Manager::Manager() noexcept
        : autoOffHandler_      {}
        , autoDimHandler_      {}
        , motionActiveHandler_ {}
        , manualOnHandler_     {}
        , manualOffHandler_    {}
        , tempDimHandler_      {}
        , faultHandler_        {}
        , handlers_
        {
            &autoOffHandler_,      /* State::AutoOff      = 0 */
            &autoDimHandler_,      /* State::AutoDim      = 1 */
            &motionActiveHandler_, /* State::MotionActive = 2 */
            &manualOnHandler_,     /* State::ManualOn     = 3 */
            &manualOffHandler_,    /* State::ManualOff    = 4 */
            &tempDimHandler_,      /* State::TempDim      = 5 */
            &faultHandler_         /* State::Fault        = 6 */
        }
        , state_  { State::AutoOff }
        , config_ {}
    {
        static_assert( kStateCount == 7U,
                       "Handler table size must match State enum count." );
    }

    void Manager::init() noexcept
    {
        state_  = State::AutoOff;
        config_ = Config {};
        LOGI( kTag, "FSM initialised — state: AutoOff" );
    }

    Outputs Manager::process( Event event,
                              const EventData & data ) noexcept
    {
        const uint8_t index { static_cast< uint8_t >( state_ ) };

        if( index >= kStateCount )
        {
            LOGE( kTag, "Invalid state index %u — resetting to AutoOff",
                  static_cast< unsigned >( index ) );
            state_ = State::AutoOff;
            return assembleOutputs( State::AutoOff, data, true );
        }

        const HandlerResult result { handlers_[ index ]->process( event,
                                                                  data,
                                                                  config_ ) };

        if( result.nextState != state_ )
        {
            LOGI( kTag, "State: %u -> %u",
                  static_cast< unsigned >( state_ ),
                  static_cast< unsigned >( result.nextState ) );
        }

        state_ = result.nextState;

        return assembleOutputs( state_, data, result.sendUplink );
    }

    State Manager::currentState() const noexcept
    {
        return state_;
    }

    void Manager::setConfig( const Config &config ) noexcept
    {
        config_ = config;
    }

    const Config & Manager::config() const noexcept
    {
        return config_;
    }

    uint8_t Manager::levelForState( State state ) const noexcept
    {
        uint8_t level { 0U };

        switch( state )
        {
            case State::AutoOff:      level = 0U;                   break;
            case State::AutoDim:      level = config_.dimLevel;     break;
            case State::MotionActive: level = config_.maxLevel;     break;
            case State::ManualOn:     level = config_.manualLevel;  break;
            case State::ManualOff:    level = 0U;                   break;
            case State::TempDim:      level = config_.tempDimLevel; break;
            case State::Fault:        level = config_.maxLevel;     break;
            default:                  level = config_.maxLevel;     break;
        }

        return level;
    }

    Outputs Manager::assembleOutputs( State next,
                                      const EventData & data,
                                      bool sendUplink ) const noexcept
    {
        Outputs out {};
        out.lightLevel = levelForState( next );
        out.sendUplink = sendUplink;

        /* Telemetry */
        out.uplinkData.lux_x10    = static_cast< uint16_t >( data.lux * 10.0f );
        out.uplinkData.tempC      = data.temperature;
        out.uplinkData.humidity   = data.humidity;
        out.uplinkData.lightLevel = out.lightLevel;

        /* Sensor health — encoder maps these to 3-bit fields in flags1 */
        out.uplinkData.ambientHealth = data.ambientHealth;
        out.uplinkData.mmwaveHealth  = data.mmwaveHealth;

        /* Single-bit fields */
        out.uplinkData.motionDetected = ( next == State::MotionActive );
        out.uplinkData.thOk           = ( data.thHealth == SensorHealth::SYSTEM_OK );
        out.uplinkData.lightOk        = data.lightOk;
        return out;
    }

} /* namespace fsm */
