#ifndef SRC_COMMON_TYPES_MMWAVE_DATA_HPP
#define SRC_COMMON_TYPES_MMWAVE_DATA_HPP

#include <cstdint>
#include "sensor_health.hpp"

namespace mmwave
{

    struct Data
    {
        bool motionDetected { false };
        SensorHealth health { SensorHealth::TOTAL_FAILURE };
    };

} /* namespace mmwave */

#endif /* SRC_COMMON_TYPES_MMWAVE_DATA_HPP */
