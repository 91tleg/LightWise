#ifndef SRC_COMMON_TYPES_TH_DATA_HPP
#define SRC_COMMON_TYPES_TH_DATA_HPP

#include <cstdint>
#include "sensor_health.hpp"

namespace th
{

    struct Data
    {
        int8_t temperature { 0 };   /**< Temperature in degree celcius */
        uint8_t humidity   { 0U };  /**< Realative humidity (0-100%) */
        SensorHealth health { SensorHealth::TOTAL_FAILURE };  /**< Overall sensor health */
    };

} /* namespace th */

#endif /* SRC_COMMON_TYPES_TH_DATA_HPP */
