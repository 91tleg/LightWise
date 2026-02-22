#ifndef SRC_COMMON_TYPES_TH_DATA_HPP
#define SRC_COMMON_TYPES_TH_DATA_HPP

#include <cstdint>
#include "sensor_health.hpp"

namespace th
{
    struct Data
    {
        uint8_t temperature;  /**< Temperature in degree celcius */
        uint8_t humidity;     /**< Realative humidity (0-100%) */
        SensorHealth health;  /**< Overall sensor health state */
    };
} /* namespace th */

#endif /* SRC_COMMON_TYPES_TH_DATA_HPP */
