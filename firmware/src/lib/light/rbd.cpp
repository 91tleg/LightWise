#include "rbd.hpp"

#include "hal/rbd.h"
#include "utils/log/log.h"

namespace light
{

    namespace
    {

        constexpr char kTag[] { "Rbd" };

    } /* anonymous namespace */

    bool Rbd::setLevel( uint8_t level ) noexcept
    {
        bool result { false };

        if( level <= kMaxLevel )
        {
            const uint32_t halfCycleUs { rbd_hal_half_cycle_us() };
            const uint32_t delayUs { halfCycleUs *
                                     static_cast< uint32_t >( kMaxLevel - level ) /
                                     static_cast< uint32_t >( kMaxLevel ) };

            rbd_hal_set_delay( delayUs );

            if( level == 0U )
            {
                /* Pull output low immediately — do not wait for next zc. */
                rbd_hal_output_off();
            }

            level_  = level;
            result  = true;

            LOGD( kTag, "setLevel: %u -> delay %u us", level, delayUs );
        }

        return result;
    }

    uint8_t Rbd::getLevel() const noexcept
    {
        return level_;
    }

} /* namespace light */
