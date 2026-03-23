#ifndef SRC_LIB__AMBIENT_ALSPT19_HPP
#define SRC_LIB__AMBIENT_ALSPT19_HPP

#include <cstdint>
#include "ambient_sensor.hpp"

typedef struct AlsPt19Hw AlsPt19Hw;

namespace ambient
{

    /**
     * @class Alspt19
     * @brief ALS-PT19 ambient light sensor driver.
     *
     * Implements the `AmbientSensor` interface expected by higher-level
     * modules. The class stores a reference to a hardware configuration
     * structure.
     */
    class Alspt19 final : public AmbientSensor
    {
    public:
        /**
         * @brief Constructs an ALS-PT19 driver instance.
         *
         * @param sensor Reference to the hardware configurature structure
         *               for the sensor.
         */
        explicit constexpr Alspt19( const AlsPt19Hw & sensor )
            : sensor_ { sensor }
        {

        }

        /**
         * @brief Read ambient light level in lux.
         *
         * Converts a raw ADC measurement to lux using the sensor-specific
         * conversion routine and returns the value via the output
         * parameter.
         *
         * @param[out] lux Calculated illuminance in lux.
         * @return true if the read succeeded and `lux` was populated,
         *         false on error.
         */
        [[nodiscard]] bool read( float & lux ) const noexcept override;

    private:
        const AlsPt19Hw & sensor_;  /**< Hardware configuration pointer */

        /**
         * @brief Convert raw ADC reading to lux.
         *
         * @param rawReading Raw ADC sample from the sensor.
         * @return Calculated illuminance in lux.
         */
        [[nodiscard]] static float adcToLux( uint16_t rawReading ) noexcept;
    };

} /* namespace ambient */

#endif /* SRC_LIB__AMBIENT_ALSPT19_HPP */
