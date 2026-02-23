#ifndef SRC_MODULES_AMBIENT_AMBIENT_MANAGER_HPP
#define SRC_MODULES_AMBIENT_AMBIENT_MANAGER_HPP

#include "utils/ema.h"
#include "types/ambient_data.hpp"



namespace ambient
{
    class AmbientSensor;
    /**
     * @brief Ambient light sensor manager with redundancy and filtering.
     *
     * Manages two ambient light sensors (primary and secondary). 
     * It performs the following:
     * - Reads lux values from both sensors
     * - Applies redundancy logic when one sensor fails
     * - Averages values when both sensors are healthy
     * - Filters the resulting lux value using an exponential moving average (EMA)
     *
     * The output structure is always populated. Sensor validity must be checked
     * via AmbientData::health.
     */
    class Manager
    {
    public:
        /**
         * @brief Constructs an Manager.
         *
         * @param[in] primary   Pointer to the primary ambient sensor device.
         * @param[in] secondary Pointer to the secondary ambient sensor device.
         * @param[in] alpha     EMA smoothing factor (0.0 < alpha <= 1.0).
         */
        explicit Manager( AmbientSensor * primary, 
                          AmbientSensor * secondary,
                          float alpha );

        /**
         * @brief Updates ambient light data.
         *
         * Reads both sensors and applies redundancy and filtering logic.
         * The output data structure is always written.
         *
         * @param[out] data Ambient light data structure.
         *
         * @return true if at least one sensor provided a valid reading,
         *         false if both sensors failed or devices are invalid.
         */
        bool update( Data & data );

    private:
        AmbientSensor * const primary_;   /**< Primary ambient light sensor */
        AmbientSensor * const secondary_; /**< Secondary ambient light sensor */
        EMAFilter primaryFilter_;   /**< EMA filter for primary lux smoothing */
        EMAFilter secondaryFilter_; /**< EMA filter for secondary lux smoothing */
    };
} /* namespace ambient */

#endif /* SRC_MODULES_AMBIENT_AMBIENT_MANAGER_HPP */
