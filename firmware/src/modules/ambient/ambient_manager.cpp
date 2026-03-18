#include "ambient_manager.hpp"

#include "lib/ambient/ambient_sensor.hpp"

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
    {

    }

    bool Manager::update( Data & data ) noexcept
    {
        float luxPrimary { 0.0f };
        float luxSecondary { 0.0f };

        const bool primaryOk { primary_.get().read( luxPrimary ) };
        const bool secondaryOk { secondary_.get().read( luxSecondary ) };

        float filteredPrimary { 0.0f };
        float filteredSecondary { 0.0f };

        if( primaryOk )
        {
            static_cast< void >( primaryFilter_.get().update( luxPrimary, filteredPrimary ) );
        }

        if( secondaryOk )
        {
            static_cast< void >( secondaryFilter_.get().update( luxSecondary, filteredSecondary ) );
        }

        bool result { false };
        float lux { data.lux };  /* preserve last known */
        SensorHealth health { SensorHealth::TOTAL_FAILURE };

        if( primaryOk && secondaryOk )
        {
            const float diff { filteredPrimary - filteredSecondary };
            const float absDiff { ( diff >= 0.0f ) ? diff : -diff };

            health = ( absDiff > kDegradedThreshold )
                     ? SensorHealth::DEGRADED
                     : SensorHealth::SYSTEM_OK;
            lux = ( filteredPrimary + filteredSecondary ) * 0.5f;
            result = true;
        }
        else if( primaryOk )
        {
            health = SensorHealth::SECONDARY_FAIL;
            lux    = filteredPrimary;
            result = true;
        }
        else if( secondaryOk )
        {
            health = SensorHealth::PRIMARY_FAIL;
            lux    = filteredSecondary;
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
