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
         * @param  powerPct  Desired power [0–100]
         * @return true  Success
         * @return false Invalid parameter or driver error
         */
        [[nodiscard]] virtual bool setLevel( uint8_t powerPct ) noexcept = 0;

        /**
         * @brief Get current power setting.
         *
         * @return Current brightness level [0–100].
         */
        [[nodiscard]] virtual uint8_t getLevel() const noexcept = 0;

    protected:
        LightSensor()                                 = default;
        LightSensor( const LightSensor & )            = default;
        LightSensor &operator=( const LightSensor & ) = default;
        LightSensor( LightSensor && )                 = default;
        LightSensor &operator=( LightSensor && )      = default;
    };

} /* namespace light */

#endif /* SRC_LIB_LIGHT_LIGHT_SENSOR_HPP */