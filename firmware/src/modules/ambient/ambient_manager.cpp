#include "ambient_manager.hpp"

#include "lib/ambient/ambient_sensor.hpp"

namespace ambient
{
    namespace
    {
        constexpr float kDegradedThreshold = 10.0f;
    } /* anonymous namespace */

    Manager::Manager( AmbientSensor * const primary,
                      AmbientSensor * const secondary,
                      float alpha )
        : primary_( primary ), secondary_( secondary )
    {
        /* NOTE: alpha is clamped to (0.0, 1.0] inside ema_init() */
        ( void ) ema_init( &primaryFilter_, alpha );
        ( void ) ema_init( &secondaryFilter_, alpha );
    }

    bool Manager::update( Data & data )
    {
        bool result = false;

        const float primaryEma   = primaryFilter_.value;
        const float secondaryEma = secondaryFilter_.value;

        /* Default output */
        data.lux    = (primaryEma + secondaryEma) * 0.5f;
        data.health = SensorHealth::TOTAL_FAILURE;

        if( ( primary_ != nullptr ) && ( secondary_ != nullptr ) )
        {
            float luxPrimary   = 0.0f;
            float luxSecondary = 0.0f;

            const bool primaryOk   = primary_->read( luxPrimary );
            const bool secondaryOk = secondary_->read( luxSecondary );

            float updatedPrimaryEma = primaryEma;
            float updatedSecondaryEma = secondaryEma;

            if( primaryOk )
            {
                ( void ) ema_update( &primaryFilter_, luxPrimary, &updatedPrimaryEma );
            }

            if( secondaryOk )
            {
                ( void ) ema_update( &secondaryFilter_, luxSecondary, &updatedSecondaryEma );
            }

            /* Determine health */
            if( primaryOk && secondaryOk )
            {
                const float diff = updatedPrimaryEma - updatedSecondaryEma;
                const float absDiff = ( diff >= 0.0f ) ? diff : -diff;

                if( absDiff > kDegradedThreshold )
                {
                    data.health = SensorHealth::DEGRADED;
                }
                else
                {
                   data.health = SensorHealth::SYSTEM_OK;
                }
                result = true;
            }
            else if( primaryOk )
            {
                data.health = SensorHealth::SECONDARY_FAIL;
                result = true;
            }
            else if( secondaryOk )
            {
                data.health = SensorHealth::PRIMARY_FAIL;
                result = true;
            }
            else
            {
                data.health = SensorHealth::TOTAL_FAILURE;
                result = false;
            }

            /* Compute reported lux as average of available EMAs */
            if( primaryOk && secondaryOk )
            {
                data.lux = ( updatedPrimaryEma + updatedSecondaryEma ) * 0.5f;
            }
            else if( primaryOk )
            {
                data.lux = updatedPrimaryEma;
            }
            else if( secondaryOk )
            {
                data.lux = updatedSecondaryEma;
            }
            else 
            {
                /* Both failed, keep last known average */
                data.lux = ( primaryEma + secondaryEma ) * 0.5f;
            }
        }

        return result;
    }
} /* namespace ambient */
