#ifndef SRC_COMMON_TYPES_AMBIENT_DATA_HPP
#define SRC_COMMON_TYPES_AMBIENT_DATA_HPP

#include "sensor_health.hpp"

namespace ambient
{

    struct Data
    {
        float lux { 0.0f };
        SensorHealth health { SensorHealth::TOTAL_FAILURE };
    };

} /* namespace ambient */

#endif /* SRC_COMMON_TYPES_AMBIENT_DATA_HPP */
