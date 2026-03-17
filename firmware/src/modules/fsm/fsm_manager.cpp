#include "fsm_manager.hpp"
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
        config_ = Config{};
        LOGI( kTag, "FSM initialised — state: AutoOff" );
    }

    Outputs Manager::process( Event event, const EventData & data ) noexcept
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
            case State::AutoOff:
                level = 0U;
                break;
            case State::AutoDim:
                level = config_.dimLevel;
                break;
            case State::MotionActive:
                level = config_.maxLevel;
                break;
            case State::ManualOn:
                level = config_.manualLevel;
                break;
            case State::ManualOff:
                level = 0U;
                break;
            case State::TempDim:
                level = config_.tempDimLevel;
                break;
            case State::Fault:
                level = config_.maxLevel;
                break;
            default:
                level = config_.maxLevel;
                break;
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

        out.uplinkData.lux_x10    = static_cast< uint16_t >( data.lux * 10.0f );
        out.uplinkData.tempC      = data.temperature;
        out.uplinkData.humidity   = data.humidity;
        out.uplinkData.lightLevel = out.lightLevel;

        /* Encode status flags */
        using SF = lorawan::UplinkData::StatusFlag;
        uint8_t flags { 0U };

        if( state_ == State::MotionActive )
        {
            flags |= static_cast< uint8_t >( SF::MotionPresent );
        }
        /* Ambient sensor health */
        if( data.ambientHealth != SensorHealth::TOTAL_FAILURE &&
            data.ambientHealth != SensorHealth::PRIMARY_FAIL )
        {
            flags |= static_cast< uint8_t >( SF::AmbientPrimaryOk );
        }
        if( data.ambientHealth != SensorHealth::TOTAL_FAILURE &&
            data.ambientHealth != SensorHealth::SECONDARY_FAIL )
        {
            flags |= static_cast< uint8_t >( SF::AmbientSecondaryOk );
        }

        /* TH sensor health */
        if( data.thHealth == SensorHealth::SYSTEM_OK )
        {
            flags |= static_cast< uint8_t >( SF::ThOk );
        }

        /* mmWave sensor health */
        if( data.mmwaveHealth != SensorHealth::TOTAL_FAILURE &&
            data.mmwaveHealth != SensorHealth::PRIMARY_FAIL )
        {
            flags |= static_cast< uint8_t >( SF::MotionPrimaryOk );
        }
        if( data.mmwaveHealth != SensorHealth::TOTAL_FAILURE &&
            data.mmwaveHealth != SensorHealth::SECONDARY_FAIL )
        {
            flags |= static_cast< uint8_t >( SF::MotionSecondaryOk );
        }

        /* System degraded: any sensor degraded or in partial failure */
        const bool anyDegraded {
            ( data.ambientHealth == SensorHealth::DEGRADED       ) ||
            ( data.ambientHealth == SensorHealth::PRIMARY_FAIL   ) ||
            ( data.ambientHealth == SensorHealth::SECONDARY_FAIL ) ||
            ( data.mmwaveHealth  == SensorHealth::DEGRADED       ) ||
            ( data.mmwaveHealth  == SensorHealth::PRIMARY_FAIL   ) ||
            ( data.mmwaveHealth  == SensorHealth::SECONDARY_FAIL ) ||
            ( data.thHealth      != SensorHealth::SYSTEM_OK      ) ||
            ( state_             == State::Fault                 )
        };

        if( anyDegraded )
        {
            flags |= static_cast< uint8_t >( SF::SystemDegraded );
        }

        /* All sensors OK */
        if( !anyDegraded && ( state_ != State::Fault ) )
        {
            flags |= static_cast< uint8_t >( SF::OverallOk );
        }

        out.uplinkData.flags = flags;
    
        return out;
    }

} /* namespace fsm */
