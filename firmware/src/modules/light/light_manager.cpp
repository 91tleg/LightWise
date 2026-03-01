#include "light_manager.hpp"

#include "lib/light/light_sensor.hpp"

namespace light
{
    namespace
    {
        constexpr uint32_t kMsPerSecond = 1000U;
    } /* anonymous namespace */

    Manager::Manager( LightSensor & led, uint8_t stepsPerSecond )
        : led_( led ),
          target_( 0U ),
          stepsPerSecond_( stepsPerSecond ),
          ramping_( false )
    {

    }

    void Manager::setTarget( uint8_t target, uint8_t stepsPerSecond )
    {
        uint8_t level = 0U;
        led_.getLevel( level );

        target_         = target;
        stepsPerSecond_ = ( stepsPerSecond > 0U ) ? stepsPerSecond : 1U;
        ramping_        = ( level != target_ );
    }

    bool Manager::step()
    {
        if( ramping_ )
        {
            uint8_t current = 0U;
            if( led_.getLevel( current ) )
            {
                if( current == target_ )
                {
                    ramping_ = false;
                }
                else
                {
                    uint8_t next;
                    if( current < target_ )
                    {
                        next = clamp( static_cast<uint8_t>( current + 1U ), 0U, target_ );
                    }
                    else
                    {
                        const uint8_t decremented = ( current > 0U ) 
                                                    ? static_cast<uint8_t>( current - 1U ) 
                                                    : 0U;
                        next = clamp( decremented, target_, 0xFFU );
                    }

                    led_.setLevel( next );
                    ramping_ = ( next != target_ );
                }
            }
            else
            {
                /* getLevel failed. Leave ramping_ unchanged */
            }
        }
        else
        {
            /* Not ramping. Nothing to do */
        }

        return !ramping_;
    }

    bool Manager::isRamping() const
    {
        return ramping_;
    }

    uint8_t Manager::getTarget() const
    {
        return target_;
    }

    uint32_t Manager::stepIntervalMs() const
    {
        return kMsPerSecond / static_cast<uint32_t>( stepsPerSecond_ );
    }

    constexpr uint8_t Manager::clamp( uint8_t value, uint8_t low, uint8_t high )
    {
        uint8_t result = value;
        if( value < low )
        {
            result = low;
        }
        else if( value > high )
        {
            result = high;
        }
        else
        {
            /* value is within range */
        }
        return result;
    }

} /* namespace light */
