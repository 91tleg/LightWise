#ifndef SRC_MODULES_MMWAVE_MMWAVE_MANAGER_HPP
#define SRC_MODULES_MMWAVE_MMWAVE_MANAGER_HPP

#include <cstdint>

#include "lib/c4001.h"
#include "types/mmwave_data.hpp"

namespace mmwave
{
    class MmwaveSensor;
    /**
     * @brief Manager class for dual mmWave sensors.
     *
     * Handles initialization, configuration, and motion detection
     * for a primary and secondary device. Tracks sensor health
     * and failure counts.
     */
    class Manager
    {
    public:
        /**
         * @brief Construct a MmwaveManager for two sensors.
         * 
         * @param primary   Pointer to primary mmWave.
         * @param secondary Pointer to secondary mmWave.
         */
        explicit Manager( MmwaveSensor * primary,
                          MmwaveSensor * secondary );

        /**
         * @brief Initialize both sensors.
         *
         * Sets sensor mode, detection range, and trigger sensitivity.
         *
         * @return true if both sensors were configured successfully, false otherwise.
         */
        bool setup();

        /**
         * @brief Read motion and update sensor health.
         *
         * Updates MmwaveData struct with current motion detection state
         * and health status of each sensor. Motion is true if either sensor
         * detects movement.
         *
         * @param[out] data  Reference to MmwaveData to populate.
         * @return true if at least one sensor successfully returned motion data, false if both failed.
         */
        bool update( Data & data );

    private:
        MmwaveSensor * primary_;   /**< Primary sensor pointer */
        MmwaveSensor * secondary_; /**< Secondary sensor pointer */

        uint8_t primaryFailureCount_;   /**< Number of consecutive primary sensor failures */
        uint8_t secondaryFailureCount_; /**< Number of consecutive secondary sensor failures */

        bool lastPrimaryMotion_;
        bool lastSecondaryMotion_;
    };
} /* namespace mmwave */

#endif /* SRC_MODULES_MMWAVE_MMWAVE_MANAGER_HPP */
