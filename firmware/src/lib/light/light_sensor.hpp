#ifndef SRC_LIB_LIGHT_LIGHT_SENSOR_HPP
#define SRC_LIB_LIGHT_LIGHT_SENSOR_HPP

#include <cstdint>

namespace light
{

    /**
     * @brief Pure virtual interface for a dimmable light output.
     */
    class LightSensor
    {
    public:
        virtual ~LightSensor() = default;

        /**
         * @brief Set output power.
         *
         * @param power_pct  Desired power [0–100]
         * @return true  Success
         * @return false Invalid parameter or driver error
         */
        [[nodiscard]] virtual bool setLevel( uint8_t level ) noexcept = 0;

        /**
         * @brief Get current power setting.
         *
         * Returns 0 when the dimmer is off.
         *
         * @param out  Output power percentage
         * @return true  Success
         * @return false Invalid parameter or driver error
         */
        [[nodiscard]] virtual bool getLevel( uint8_t & level ) const noexcept = 0;

    protected:
        LightSensor()                                 = default;
        LightSensor( const LightSensor & )            = default;
        LightSensor &operator=( const LightSensor & ) = default;
        LightSensor( LightSensor && )                 = default;
        LightSensor &operator=( LightSensor && )      = default;
    };

} /* namespace light */

#endif /* SRC_LIB_LIGHT_LIGHT_SENSOR_HPP */