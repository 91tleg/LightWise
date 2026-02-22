#ifndef SRC_LIB_TH_TH_SENSOR_HPP
#define SRC_LIB_TH_TH_SENSOR_HPP

#include <cstdint>

namespace th
{
    class THSensor
    {
    public:
        virtual ~THSensor() = default;
        
        virtual bool init() = 0;
        virtual bool read( uint8_t & temperature,
                           uint8_t & humidity ) const = 0;
    };
} /* namespace th */

#endif /* SRC_LIB_TH_TH_SENSOR_HPP */
