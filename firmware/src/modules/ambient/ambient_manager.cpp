#include "ambient_manager.hpp"

#include "lib/ambient/ambient_sensor.hpp"
#include "types/ambient_data.hpp"
#include "utils/math/ema.hpp"
#include "utils/log/log.h"

namespace ambient
{

    Manager::Manager( AmbientSensor & primary,
                      AmbientSensor & secondary,
                      filter::EMA< float > & primaryFilter,
                      filter::EMA< float > & secondaryFilter ) noexcept
        : primary_ { primary }
        , secondary_ { secondary }
        , primaryFilter_ { primaryFilter }
        , secondaryFilter_ { secondaryFilter }
        , filteredPrimary_  { 0.0f }
        , filteredSecondary_ { 0.0f }
    {

    }

    bool Manager::update( Data & data ) noexcept
    {
        float luxPrimary { 0.0f };
        float luxSecondary { 0.0f };

        const bool primaryOk { primary_.read( luxPrimary ) };
        const bool secondaryOk { secondary_.read( luxSecondary ) };

        if( primaryOk )
        {
            static_cast< void >( primaryFilter_.update( luxPrimary, filteredPrimary_ ) );
        }

        if( secondaryOk )
        {
            static_cast< void >( secondaryFilter_.update( luxSecondary, filteredSecondary_ ) );
        }
        LOGI( "ambient_manager", "fP: %f, fS: %f, diff: %f",
                filteredPrimary_,
                filteredSecondary_,
                filteredPrimary_ - filteredSecondary_ );

        bool result { false };
        float lux { data.lux };  /* preserve last known */
        SensorHealth health { SensorHealth::TOTAL_FAILURE };

        if( primaryOk && secondaryOk )
        {
            const float diff { filteredPrimary_ - filteredSecondary_ };
            const float absDiff { ( diff >= 0.0f ) ? diff : -diff };

            health = ( absDiff > kDegradedThreshold )
                     ? SensorHealth::DEGRADED
                     : SensorHealth::SYSTEM_OK;
            lux = ( filteredPrimary_ + filteredSecondary_ ) * 0.5f;
            result = true;
        }
        else if( primaryOk )
        {
            health = SensorHealth::SECONDARY_FAIL;
            lux    = filteredPrimary_;
            result = true;
        }
        else if( secondaryOk )
        {
            health = SensorHealth::PRIMARY_FAIL;
            lux    = filteredSecondary_;
            result = true;
        }
        else
        {
            health = SensorHealth::TOTAL_FAILURE;
            result = false;
        }

        data.lux    = lux;
        data.health = health;
        return result;
    }

} /* namespace ambient */
