#ifndef SRC_LIB_AMBIENT_AMBIENT_SENSOR_HPP
#define SRC_LIB_AMBIENT_AMBIENT_SENSOR_HPP

namespace ambient
{
    class AmbientSensor
    {
    public:
        virtual ~AmbientSensor() = default;
        
        virtual bool init() = 0;
        virtual bool read( float & lux ) const = 0;
    };
} /* namespace ambient */

#endif /* SRC_LIB_AMBIENT_AMBIENT_SENSOR_HPP */
