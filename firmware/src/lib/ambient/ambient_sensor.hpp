#ifndef SRC_LIB_AMBIENT_AMBIENT_SENSOR_HPP
#define SRC_LIB_AMBIENT_AMBIENT_SENSOR_HPP

namespace ambient
{

    /**
     * @brief  Pure virtual interface for an ambient light sensor.
     */
    class AmbientSensor
    {
    public:
        virtual ~AmbientSensor() = default;

        /**
         * @brief  Read the current illuminance.
         *
         * @param  lux  Filled with the measured value in lux on success.
         * @return true  if the read succeeded and lux is valid.
         * @return false if the sensor is unavailable or returned an error.
         */
        [[nodiscard]] virtual bool read( float & lux ) const noexcept = 0;

    protected:
        AmbientSensor()                                   = default;
        AmbientSensor( const AmbientSensor & )            = default;
        AmbientSensor &operator=( const AmbientSensor & ) = default;
        AmbientSensor( AmbientSensor && )                 = default;
        AmbientSensor &operator=( AmbientSensor && )      = default;
    };

} /* namespace ambient */

#endif /* SRC_LIB_AMBIENT_AMBIENT_SENSOR_HPP */
