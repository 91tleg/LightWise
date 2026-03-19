#ifndef SRC_LIB_TH_TH_SENSOR_HPP
#define SRC_LIB_TH_TH_SENSOR_HPP

#include <cstdint>

namespace th
{

    class THSensor
    {
    public:
        virtual ~THSensor() = default;

        /**
         * @brief  Read temperature and humidity from the sensor.
         *
         * @param  temperature  Filled with raw temperature on success.
         * @param  humidity     Filled with raw humidity on success.
         * @return true  if the read succeeded and values are valid.
         * @return false if the sensor is unavailable or returned an error.
         */
        [[nodiscard]] virtual bool read( uint8_t & temperature,
                                         uint8_t & humidity ) const noexcept = 0;

        protected:
            THSensor()                              = default;
            THSensor( const THSensor & )            = default;
            THSensor &operator=( const THSensor & ) = default;
            THSensor( THSensor && )                 = default;
            THSensor &operator=( THSensor && )      = default;
    };

} /* namespace th */

#endif /* SRC_LIB_TH_TH_SENSOR_HPP */
