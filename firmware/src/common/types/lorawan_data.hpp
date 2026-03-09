#ifndef SRC_COMMON_TYPES_LORAWAN_DATA_HPP
#define SRC_COMMON_TYPES_LORAWAN_DATA_HPP

#include <cstdint>

namespace lorawan
{
    struct UplinkData
    {
        uint16_t lux_x10;   /* lux * 10 */
        int8_t tempC;       /* signed °C */
        uint8_t humidity;   /* 0–100% */
        uint8_t lightLevel; /* 0–100% */

        enum class StatusFlag : uint8_t
        {
            MotionPresent = ( 1U << 0 ),
            AmbientPrimaryOk = ( 1U << 1 ),
            AmbientSecondaryOk = ( 1U << 2 ),
            ThOk = ( 1U << 3 ),
            MotionPrimaryOk = ( 1U << 4 ),
            MotionSecondaryOk = ( 1U << 5 ),
            SystemDegraded = ( 1U << 6 ),
            OverallOk = ( 1U << 7 )
        };

        uint8_t flags; /* encoded StatusFlag bitmask */
    };
} /* namespace lorawan*/

#endif /* SRC_COMMON_TYPES_LORAWAN_DATA_HPP */
