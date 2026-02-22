#ifndef SRC_MODULES_TH_TH_MANAGER_HPP
#define SRC_MODULES_TH_TH_MANAGER_HPP

#include <cstdint>

#include "utils/ema.h"
#include "types/th_data.hpp"

namespace th
{
    class THSensor;

    /**
     * @brief Manages temperature and humidity sensor access and filtering.
     *
     * This class provides a high-level interface for any temperature and humidity
     * sensor implementing the THSensor interface. Raw sensor readings are filtered
     * using an exponential moving average (EMA) to reduce noise and provide
     * smooth output data.
     */
    class Manager
    {
    public:
        /**
         * @brief Constructs a temperature and humidity sensor manager instance.
         *
         * @param[in] primary Pointer to the primary temperature and humidity sensor
         *                    implementing the THSensor interface.
         *                    The pointer must remain valid for the lifetime
         *                    of this Manager object.
         * @param[in] alpha   EMA filter coefficient in the range (0.0, 1.0].
         *                    Higher values give more weight to recent readings.
         * 
         * @note The update() function always populates the output structure.
         *       The validity of the data is indicated by Data::health field.
         * @note The manager does not take ownership of the sensor device.
         */
        explicit Manager( THSensor * primary, float alpha );

        /**
         * @brief Updates sensor readings with filtered temperature and humidity values.
         * 
         * Reads raw sensor data, applies EMA filtering, validates the readings
         * against acceptable ranges, and reports the sensor health status.
         * 
         * @param[out] data The sensor data structure containing:
         *                  - temperature: Filtered temperature reading (0-255).
         *                  - humidity: Filtered humidity reading (0-255).
         *                  - health: SensorHealth status indicating data validity.
         * 
         * @return true if valid filtered data was obtained and written to @p data,
         *         false if sensor read or filtering failed.
         *         
         * @note The @p data structure is always populated, even on failure.
         *       Callers must check the health field to determine data validity.
         */
        bool update( Data & data );

    private:
        THSensor * primary_;           /**< Pointer to the temperature/humidity sensor */
        EMAFilter temperatureFilter_;  /**< EMA filter for temperature data smoothing */
        EMAFilter humidityFilter_;     /**< EMA filter for humidity data smoothing */
    };
} /* namespace th */

#endif /* SRC_MODULES_TH_TH_MANAGER_HPP */
