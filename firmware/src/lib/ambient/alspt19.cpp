#include "alspt19.hpp"
#include "hal/alspt19.h"

namespace ambient
{

    namespace
    {

        constexpr uint16_t kAdcMax { 4095U   };
        constexpr float kLuxMax    { 1000.0f };

    } /* anonymous namespace */

    bool Alspt19::read( float & lux ) const noexcept
    {
        bool result { false };

        uint16_t rawReading { 0U };

        if( alspt19_hal_read( &sensor_, &rawReading ) )
        {
            lux = adcToLux( rawReading );
            result = true;
        }

        return result;
    }

    float Alspt19::adcToLux( uint16_t rawReading ) noexcept
    {
        float lux { 0.0f };

        if( rawReading > kAdcMax )
        {
            rawReading = kAdcMax;
        }
        
        if( rawReading > 0U )
        {
            lux = ( static_cast< float >( rawReading) /
                    static_cast< float >( kAdcMax) * kLuxMax );
        }
    
        return lux;
    }

} /* namespace ambient */