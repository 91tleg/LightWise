#include "light_manager.hpp"

#include <algorithm>  /* std::clamp */

#include "lib/light/light_sensor.hpp"
#include "lib/light/led_presence.hpp"
#include "utils/log/log.h"

namespace light
{

    namespace
    {

        constexpr char kTag[] { "LightManager" };

    } /* anonymous namespace */

    Manager::Manager( LightSensor & led, LedPresence & detect ) noexcept
        : led_           { led    }
        , detect_        { detect }
        , current_       { 0U     }
        , target_        { 0U     }
        , stepsPerSecond_{ 1U     }
        , ramping_       { false  }
    {

    }

    void Manager::setTarget( uint8_t target, uint8_t stepsPerSecond ) noexcept
    {
        target_         = target;
        stepsPerSecond_ = ( stepsPerSecond > 0U ) ? stepsPerSecond : 1U;
        ramping_        = ( current_ != target_ );
    }

    bool Manager::step() noexcept
{
    bool complete { true };

        if( ramping_ )
        {
            /* Compute the next level: one step toward target. */
            uint8_t next { current_ };

            if( current_ < target_ )
            {
                next = std::clamp( static_cast< uint8_t >( current_ + 1U ),
                                   kLevelMin,
                                   target_ );
            }
            else if( current_ > target_ )
            {
                next = std::clamp( static_cast< uint8_t >( current_ - 1U ),
                                   target_,
                                   kLevelMax );
            }
            else
            {
                /* current_ == target_: ramp finished cleanly on previous step. */
                ramping_ = false;
            }

            if( ramping_ )
            {
                /* Attempt to apply the new level to hardware. */
                if( led_.setLevel( next ) )
                {
                    /* Write succeeded: advance current_ and re-evaluate ramp. */
                    current_ = next;
                    ramping_ = ( current_ != target_ );
                }
                else
                {
                    /* Write failed: hold current_; retry on next call.
                    * Intentionally do NOT update ramping_ here: the ramp must
                    * not be declared complete until hardware confirms the level,
                    * even if the rolled-back current_ happens to equal target_. */
                    LOGW( kTag, "setLevel failed at %u: retrying next step", next );
                }
            }

            complete = !ramping_;
        }

        return complete;
    }

    bool Manager::isRamping() const noexcept
    {
        return ramping_;
    }

    uint8_t Manager::getTarget() const noexcept
    {
        return target_;
    }

    uint32_t Manager::stepIntervalMs() const noexcept
    {
        return kMsPerSecond / static_cast< uint32_t >( stepsPerSecond_ );
    }

    bool Manager::isPresent() const noexcept
    {
        return detect_.isPresent();
    }

} /* namespace light */
