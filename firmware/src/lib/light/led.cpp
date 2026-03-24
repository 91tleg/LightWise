#include "led.hpp"
#include "hal/led.h"

namespace light
{

    namespace
    {

        /* Gamma-corrected lookup table (0–100), clamped to 12-bit max */
        static constexpr uint16_t kGammaTable[ 101 ] =
        {
            0U,    1U,    2U,    5U,    9U,    14U,   20U,   28U,   37U,   47U,
            59U,   72U,   87U,   103U,  120U,  139U,  160U,  182U,  205U,  230U,
            257U,  285U,  315U,  346U,  379U,  414U,  450U,  488U,  528U,  569U,
            612U,  657U,  703U,  751U,  801U,  852U,  906U,  961U,  1018U, 1077U,
            1137U, 1199U, 1263U, 1329U, 1397U, 1466U, 1537U, 1610U, 1685U, 1761U,
            1839U, 1919U, 2001U, 2085U, 2170U, 2257U, 2346U, 2437U, 2530U, 2624U,
            2720U, 2818U, 2918U, 3020U, 3123U, 3229U, 3336U, 3445U, 3556U, 3669U,
            3784U, 3901U, 4019U, 4095U, 4095U, 4095U, 4095U, 4095U, 4095U, 4095U,
            4095U, 4095U, 4095U, 4095U, 4095U, 4095U, 4095U, 4095U, 4095U, 4095U,
            4095U, 4095U, 4095U, 4095U, 4095U, 4095U, 4095U, 4095U, 4095U, 4095U,
            4095U
        };

    } /* anonymous namespace */

    bool Led::setLevel( uint8_t powerPct ) noexcept
    {
        bool result { false };

        if( powerPct <= kMaxLevel )
        {
            const uint32_t pwmValue { levelToPwmDuty( powerPct ) };

            if( led_hal_set_level( &sensor_, pwmValue ) )
            {
                level_ = powerPct;
                result = true;
            }
        }

        return result;
    }

    uint8_t Led::getLevel() const noexcept
    {
        return level_;
    }

    uint32_t Led::levelToPwmDuty( uint8_t level ) noexcept
    {
        const uint8_t clampedLevel { ( level <= kMaxLevel ) ? level : kMaxLevel };
        return static_cast< uint32_t >( kGammaTable[ clampedLevel ] );
    }

} /* namesapce light */
