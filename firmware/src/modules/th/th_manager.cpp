#include "th_manager.hpp"
#include "lib/th/th_sensor.hpp"

namespace th
{
    namespace
    {
        constexpr float kReadingMinValue = 0.0f;    /**< Minimum valid reading value */
        constexpr float kReadingMaxValue = 255.0f;  /**< Maximum valid reading value */
    } /* anonymous namespace */

    Manager::Manager( THSensor * primary, float alpha )
        : primary_( primary )
    {
        ema_init( &temperatureFilter_, alpha );
        ema_init( &humidityFilter_, alpha );
    }

    bool Manager::update( Data & data )
    {
        bool result = false;

        /* Default output */
        data.temperature = 0U;
        data.humidity    = 0U;
        data.health      = SensorHealth::TOTAL_FAILURE;

        if( primary_ != nullptr )
        {
            uint8_t ucTemperature = 0U;
            uint8_t ucHumidity    = 0U;

            if( primary_->read( ucTemperature, ucHumidity ) )
            {
                float fTemperature = 0.0f;
                float fHumidity    = 0.0f;

                if( ema_update( &temperatureFilter_,
                                static_cast<float>( ucTemperature ),
                                &fTemperature ) &&
                    ema_update( &humidityFilter_,
                                static_cast<float>( ucHumidity ),
                                &fHumidity ) )
                {
                    if( ( fTemperature >= kReadingMinValue ) &&
                        ( fTemperature <= kReadingMaxValue ) &&
                        ( fHumidity    >= kReadingMinValue ) &&
                        ( fHumidity    <= kReadingMaxValue ) )
                    {
                        data.temperature = static_cast<uint8_t>( fTemperature );
                        data.humidity    = static_cast<uint8_t>( fHumidity );
                        data.health      = SensorHealth::SYSTEM_OK;
                        result = true;
                    }
                }
            }
        }

        return result;
    }
} /* namespace th */
