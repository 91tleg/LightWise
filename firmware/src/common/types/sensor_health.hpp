#ifndef SRC_COMMON_TYPES_SENSOR_HEALTH_HPP
#define SRC_COMMON_TYPES_SENSOR_HEALTH_HPP

#include <cstdint>

enum class SensorHealth : uint8_t
{
    SYSTEM_OK      = 0U,
    PRIMARY_FAIL   = 1U,
    SECONDARY_FAIL = 2U,
    TOTAL_FAILURE  = 3U,
    DEGRADED       = 4U,
};

#endif /* SRC_COMMON_TYPES_SENSOR_HEALTH_HPP */
