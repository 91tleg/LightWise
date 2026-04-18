#ifndef SRC_LIB_TH_AHT20_HPP
#define SRC_LIB_TH_AHT20_HPP

#include <cstdint>
#include <span>

#include "th_sensor.hpp"

typedef struct Aht20Hw Aht20Hw;

namespace th
{

    /**
     * @class Aht20
     * @brief Aht20 temperature and humidity sensor driver.
     * 
     * Implements the THSensor interface for the Aht20 I2C temperature
     * and humidity sensor.
     */
    class Aht20 final : public THSensor
    {
    public:
        /**
         * @brief Constructs a Aht20 sensor instance.
         * 
         * @param hw Reference to the hardware config structure for the Aht20 sensor.
         */
        explicit constexpr Aht20( const Aht20Hw & hw )
            : hw_ { hw }
        {

        }

        [[nodiscard]] bool init() noexcept;

        /**
         * @brief Reads temperature and humidity from the sensor.
         * 
         * @param[out] temperature The temperature value in degrees Celsius.
         * @param[out] humidity The relative humidity value in percentage.
         * @return true if read successful, false otherwise.
         */
        [[nodiscard]] bool read( int8_t & temperature, 
                                 uint8_t & humidity ) const noexcept override;

    private:
        const Aht20Hw & hw_;  /**< Reference to hardware configuration structure */

        [[nodiscard]] bool isBusy() const noexcept;
        [[nodiscard]] uint8_t status() const noexcept;
    };

} /* namespace th */

#endif /* SRC_LIB_TH_AHT20_HPP */
