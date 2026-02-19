#ifndef SRC_COMMON_TYPES_AMBIENT_DATA_HPP
#define SRC_COMMON_TYPES_AMBIENT_DATA_HPP

#include "sensor_health.hpp"

namespace ambient
{
    struct Data
    {
        float lux;           /* EMA-filtered ambient light level */
        SensorHealth health; /* Overall sensor health state */
    };
} /* namespace ambient */

#endif /* SRC_COMMON_TYPES_AMBIENT_DATA_HPP */
